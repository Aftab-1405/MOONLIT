#!/usr/bin/env python3
"""
Benchmark VAMP retrieval behavior with and without lexical calibration/fallback.

- Systems: Evaluates "strict vector" vs "lexical fallback" modes.
- Metrics: Measures answer hit rate and retrieval latency.
- Bullets: VAMP uses memory bullets to maintain concise, high-density context.
- Separation: Build, retrieve, and answer times are separated to isolate VAMP overhead.
"""

import sys
import os
import argparse
import asyncio
import json
import time
import csv
from datetime import datetime

# Add parent directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.infrastructure.firestore.firestore_service import FirestoreService
from app.features.vamp_memory.infrastructure.summary_block_repository import SummaryBlockRepository
from app.features.vamp_memory.application.vamp_memory_service import VampMemoryService, format_historical_context, adaptive_k

# Helper for string normalization (whitespace & case)
def normalize_string(s: str) -> str:
    return " ".join(s.lower().split())

def check_answer_hit(context: str, acceptable_answers: list) -> int:
    norm_context = normalize_string(context)
    for ans in acceptable_answers:
        if normalize_string(ans) in norm_context:
            return 1
    return 0

def check_term_hit(context: str, identifiers: list, expected_terms: list) -> int:
    norm_context = normalize_string(context)
    norm_identifiers = [normalize_string(i) for i in identifiers]
    for term in expected_terms:
        norm_term = normalize_string(term)
        if norm_term in norm_context:
            return 1
        for ident in norm_identifiers:
            if norm_term in ident:
                return 1
    return 0

def dedupe_sort_budget(blocks: list, budget_chars: int) -> list:
    deduped = {}
    for block in blocks:
        summary_id = block.get("summary_id")
        if not summary_id:
            continue
        deduped[summary_id] = block

    sorted_blocks = sorted(
        deduped.values(), key=lambda item: int(item.get("idx", 0) or 0)
    )
    selected = []
    used = 0
    for block in sorted_blocks:
        text_len = len(str(block.get("text", "")))
        if selected and used + text_len > budget_chars:
            continue
        selected.append(block)
        used += text_len
    return selected

async def strict_vector_only_retrieve(
    service: VampMemoryService,
    conversation_id: str,
    user_id: str,
    question: str,
    k: int | None = None,
    include_latest: bool = False,
    budget_chars: int | None = None,
) -> list:
    conv = service.summary_repo.get_conversation(conversation_id) or {}
    if conv and conv.get("user_id") not in (None, user_id):
        raise PermissionError("User does not own this conversation")

    total = int(conv.get("summary_count", 0) or 0)
    if total <= 0:
        return []

    effective_k = k or adaptive_k(total)
    query_vector = await service._embed(question)

    hits = service.vector_store.search(
        conversation_id=conversation_id,
        query_vector=query_vector,
        k=effective_k,
        user_id=user_id,
    )
    if asyncio.iscoroutine(hits):
        hits = await hits

    summary_ids = [h["summary_id"] for h in hits if h.get("summary_id")]
    blocks = service.summary_repo.get_blocks_by_ids(conversation_id, summary_ids)

    score_by_id = {
        hit["summary_id"]: {"score": hit.get("score", 0.0), "rank": rank}
        for rank, hit in enumerate(hits) if "summary_id" in hit
    }
    for block in blocks:
        meta = score_by_id.get(block.get("summary_id"), {})
        block["_retrieval_score"] = meta.get("score", 0.0)
        block["_retrieval_rank"] = meta.get("rank", 999999)

    if include_latest:
        latest = service.summary_repo.get_latest_block(conversation_id)
        if latest:
            latest["_retrieval_score"] = 999999.0
            latest["_retrieval_rank"] = -1
            blocks.append(latest)

    budget = budget_chars or service.context_budget_chars
    return service._dedupe_select_budget_then_sort(blocks, budget_chars=budget)

def legacy_format_historical_context(blocks: list) -> str:
    sections = []
    for b in sorted(blocks, key=lambda x: int(x.get("idx", 0) or 0)):
        idx = int(b.get("idx", 0) or 0)
        text = b.get("text", "").strip()
        if text:
            sections.append(f"[Memory block {idx}]\n{text}")
    return "\n\n".join(sections)

def get_median(values: list) -> float:
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    if n % 2 == 1:
        return float(sorted_vals[n // 2])
    else:
        return float((sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2.0)

def get_p95(values: list) -> float:
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    idx = int(len(sorted_vals) * 0.95)
    return float(sorted_vals[min(idx, len(sorted_vals) - 1)])

async def main():
    parser = argparse.ArgumentParser(description="Benchmark VAMP retrieval modes.")
    parser.add_argument("--conversation-id", required=True, help="Conversation ID to retrieve from")
    parser.add_argument("--user-id", required=True, help="User ID owning the conversation")
    parser.add_argument("--eval-file", required=True, help="Path to evaluation cases JSON")
    parser.add_argument("--out-dir", required=True, help="Directory to save benchmark reports")
    parser.add_argument("--k-override", type=int, help="Fixed k for vector search in both modes")
    parser.add_argument("--budget-chars", type=int, help="Override context character budget")
    parser.add_argument("--include-latest", action="store_true", help="Include latest summary block in strict mode")
    parser.add_argument("--modes", default="strict_vamp,vamp_with_lexical", help="Comma-separated modes to run")
    parser.add_argument("--answer-generation", action="store_true", help="Unused flag preserved for compat")
    parser.add_argument("--repeat", type=int, default=1, help="Repeat retrieval count for timing stability")

    args = parser.parse_args()

    # Initialize Firestore Service
    FirestoreService.initialize()

    # Load eval cases
    if not os.path.exists(args.eval_file):
        print(f"Error: Eval file '{args.eval_file}' does not exist.")
        sys.exit(1)

    with open(args.eval_file, "r") as f:
        eval_cases = json.load(f)

    # Check summary block readiness (Task 3)
    conv = SummaryBlockRepository.get_conversation(args.conversation_id)
    if not conv:
        print(f"Error: Conversation '{args.conversation_id}' not found in Firestore.")
        sys.exit(1)

    summary_count = int(conv.get("summary_count", 0) or 0)
    if summary_count == 0:
        print("\nConversation has no VAMP summary blocks yet. Run the seeded conversation through normal summarization first.")
        sys.exit(1)

    selected_modes = [m.strip() for m in args.modes.split(",") if m.strip()]
    latest_block_idx = conv.get("latest_summary_block_idx", 0)

    print("\n==========================================")
    print("VAMP RETRIEVAL BENCHMARK INITIALIZATION")
    print(f"Conversation ID: {args.conversation_id}")
    print(f"User ID:         {args.user_id}")
    print(f"Summary Count:   {summary_count}")
    print(f"Latest Block:    {latest_block_idx}")
    print(f"Eval Cases:      {len(eval_cases)}")
    print(f"Selected Modes:  {', '.join(selected_modes)}")
    print("==========================================\n")

    vamp_service = VampMemoryService()

    # Initialize results list
    results = []

    for case in eval_cases:
        question_id = case["id"]
        question = case["question"]
        expected_answer = case["expected_answer"]
        acceptable_answers = case["acceptable_answers"]
        expected_terms = case["expected_terms"]

        for mode in selected_modes:
            retrieve_times = []
            blocks = []

            # Execute retrieval mode
            for rep in range(args.repeat):
                start_time = time.perf_counter()
                if mode == "strict_vamp":
                    # This acts as Legacy Full-Block retrieval by bypassing context minification
                    blocks = await strict_vector_only_retrieve(
                        vamp_service,
                        args.conversation_id,
                        args.user_id,
                        question,
                        k=args.k_override,
                        include_latest=args.include_latest,
                        budget_chars=args.budget_chars
                    )
                elif mode == "vamp_with_lexical":
                    # This mode now actually tests VAMP v2 Bullet Pointers
                    orig_budget = vamp_service.context_budget_chars
                    if args.budget_chars:
                        vamp_service.context_budget_chars = args.budget_chars
                    
                    blocks = await vamp_service.retrieve_blocks(
                        args.conversation_id,
                        args.user_id,
                        question,
                        k=args.k_override
                    )
                    
                    vamp_service.context_budget_chars = orig_budget
                else:
                    print(f"Warning: Unknown mode '{mode}' skipped.")
                    continue
                end_time = time.perf_counter()
                retrieve_times.append((end_time - start_time) * 1000.0)

            # Performance scoring
            avg_retrieve_ms = sum(retrieve_times) / len(retrieve_times)
            if mode == "strict_vamp":
                context = legacy_format_historical_context(blocks) or ""
            else:
                context = format_historical_context(blocks) or ""
            context_chars = len(context)
            context_token_estimate = int(context_chars / 4)

            # Hit rate scoring
            ans_hit = check_answer_hit(context, acceptable_answers)
            
            # Extract block identifiers
            summary_ids = [str(b.get("summary_id", "")) for b in blocks if b.get("summary_id") is not None]
            indices = [str(b.get("idx", "")) for b in blocks if b.get("idx") is not None]
            identifiers_set = set()
            for b in blocks:
                for ident in b.get("identifiers", []):
                    if ident:
                        identifiers_set.add(str(ident))
            identifiers = sorted(list(identifiers_set))

            term_hit = check_term_hit(context, identifiers, expected_terms)

            results.append({
                "question_id": question_id,
                "question": question,
                "mode": mode,
                "context_answer_hit": ans_hit,
                "term_hit": term_hit,
                "context_chars": context_chars,
                "context_token_estimate": context_token_estimate,
                "retrieve_ms": avg_retrieve_ms,
                "retrieved_summary_ids": ",".join(summary_ids),
                "retrieved_indices": ",".join(indices),
                "retrieved_identifiers": ",".join(identifiers),
                "expected_answer": expected_answer,
                "acceptable_answers": json.dumps(acceptable_answers),
                "expected_terms": json.dumps(expected_terms)
            })

    # Group and calculate summary metrics
    stats = {}
    for mode in selected_modes:
        mode_results = [r for r in results if r["mode"] == mode]
        if not mode_results:
            continue
        total_cases = len(mode_results)
        ans_hits = sum(r["context_answer_hit"] for r in mode_results)
        t_hits = sum(r["term_hit"] for r in mode_results)
        token_estimates = [r["context_token_estimate"] for r in mode_results]
        chars = [r["context_chars"] for r in mode_results]
        latencies = [r["retrieve_ms"] for r in mode_results]

        stats[mode] = {
            "total_cases": total_cases,
            "context_answer_hit_rate": ans_hits / total_cases if total_cases > 0 else 0.0,
            "term_hit_rate": t_hits / total_cases if total_cases > 0 else 0.0,
            "avg_context_token_estimate": sum(token_estimates) / total_cases if total_cases > 0 else 0.0,
            "avg_context_chars": sum(chars) / total_cases if total_cases > 0 else 0.0,
            "avg_retrieve_ms": sum(latencies) / total_cases if total_cases > 0 else 0.0,
            "median_retrieve_ms": get_median(latencies),
            "p95_retrieve_ms": get_p95(latencies)
        }

    # Write output reports
    os.makedirs(args.out_dir, exist_ok=True)
    
    # 1. Per-case CSV (results.csv)
    csv_path = os.path.join(args.out_dir, "results.csv")
    csv_headers = [
        "question_id", "question", "mode", "context_answer_hit", "term_hit",
        "context_chars", "context_token_estimate", "retrieve_ms",
        "retrieved_summary_ids", "retrieved_indices", "retrieved_identifiers",
        "expected_answer", "acceptable_answers", "expected_terms"
    ]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_headers)
        writer.writeheader()
        for r in results:
            writer.writerow(r)
    print(f"Results CSV written to: {csv_path}")

    # 2. Summary JSON
    summary_path = os.path.join(args.out_dir, "summary.json")
    summary_data = {
        "metadata": {
            "conversation_id": args.conversation_id,
            "user_id": args.user_id,
            "eval_file": args.eval_file,
            "timestamp": datetime.now().isoformat(),
            "k_override": args.k_override,
            "budget_chars": args.budget_chars or vamp_service.context_budget_chars,
            "include_latest": args.include_latest
        },
        "stats": stats
    }
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2)
    print(f"Summary JSON written to: {summary_path}")

    # 3. Generate Analysis & Recommendations (Task 2)
    strict_res = {r["question_id"]: r for r in results if r["mode"] == "strict_vamp"}
    lexical_res = {r["question_id"]: r for r in results if r["mode"] == "vamp_with_lexical"}

    strict_failures = []
    lexical_failures = []
    lexical_helped = []
    lexical_hurt = []
    both_failed = []

    for case in eval_cases:
        qid = case["id"]
        q = case["question"]
        expected = case["expected_answer"]
        s_hit = strict_res[qid]["context_answer_hit"] if qid in strict_res else 0
        l_hit = lexical_res[qid]["context_answer_hit"] if qid in lexical_res else 0

        # Track strict failures
        if s_hit == 0:
            strict_failures.append({"id": qid, "question": q, "expected": expected})

        # Track lexical failures
        if l_hit == 0:
            lexical_failures.append({"id": qid, "question": q, "expected": expected})

        # Compare behaviors
        if s_hit == 0 and l_hit == 1:
            lexical_helped.append({"id": qid, "question": q, "expected": expected})
        elif s_hit == 1 and l_hit == 0:
            lexical_hurt.append({"id": qid, "question": q, "expected": expected})
        elif s_hit == 0 and l_hit == 0:
            both_failed.append({"id": qid, "question": q, "expected": expected})

    # Decide recommendation based on actual results
    rec_text = ""
    rec_rationale = ""
    strict_acc = stats.get("strict_vamp", {}).get("context_answer_hit_rate", 0.0)
    lexical_acc = stats.get("vamp_with_lexical", {}).get("context_answer_hit_rate", 0.0)
    
    if lexical_acc > strict_acc:
        rec_text = "use VAMP v2 Memory Bullets"
        rec_rationale = f"Measured context answer hit rate is higher with Bullet Pointers enabled ({lexical_acc:.1%} vs {strict_acc:.1%})."
    elif strict_acc > lexical_acc:
        rec_text = "revert to Legacy Full-Block"
        rec_rationale = f"Legacy Full-Block mode yielded a higher answer hit rate ({strict_acc:.1%} vs {lexical_acc:.1%})."
    else:
        rec_text = "use VAMP v2 Memory Bullets"
        rec_rationale = f"Accuracies are identical ({strict_acc:.1%}), but bullet pointers usually save context budget."

    # 4. Generate Markdown report
    report_path = os.path.join(args.out_dir, "report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# VAMP Real Retrieval Benchmark Report\n\n")
        f.write("## Metadata\n")
        f.write(f"- **Conversation ID:** `{args.conversation_id}`\n")
        f.write(f"- **User ID:** `{args.user_id}`\n")
        f.write(f"- **Evaluation File:** `{args.eval_file}`\n")
        f.write(f"- **Timestamp:** `{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}`\n")
        f.write(f"- **K Override:** `{args.k_override or 'adaptive'}`\n")
        f.write(f"- **Context Budget (chars):** `{args.budget_chars or vamp_service.context_budget_chars}`\n")
        f.write(f"- **Strict Include Latest Block:** `{args.include_latest}`\n\n")

        f.write("## Overall Metrics Comparison\n\n")
        f.write("| Metric | Legacy Full-Block Vector (Historical Baseline) | VAMP v2 Bullet Pointers (Production) |\n")
        f.write("| --- | --- | --- |\n")
        
        def format_stat(key, pct=False, fmt=".1f"):
            v1 = stats.get("strict_vamp", {}).get(key, 0.0)
            v2 = stats.get("vamp_with_lexical", {}).get(key, 0.0)
            if pct:
                return f"| {key.replace('_', ' ').title()} | {v1:.1%} | {v2:.1%} |"
            return f"| {key.replace('_', ' ').title()} | {v1:{fmt}} | {v2:{fmt}} |"
            
        f.write(f"| Total Cases | {stats.get('strict_vamp', {}).get('total_cases', 0)} | {stats.get('vamp_with_lexical', {}).get('total_cases', 0)} |\n")
        f.write(format_stat("context_answer_hit_rate", pct=True) + "\n")
        f.write(format_stat("term_hit_rate", pct=True) + "\n")
        f.write(format_stat("avg_context_token_estimate") + "\n")
        f.write(format_stat("avg_context_chars") + "\n")
        f.write(format_stat("avg_retrieve_ms") + "\n")
        f.write(format_stat("median_retrieve_ms") + "\n")
        f.write(format_stat("p95_retrieve_ms") + "\n\n")

        f.write("## Recommendations\n")
        f.write(f"**Recommendation:** `{rec_text}`\n\n")
        f.write(f"**Rationale:** {rec_rationale}\n\n")

        # Helped / Hurt sections
        f.write("## Case Analysis\n\n")
        
        f.write("### Cases Where Bullet Pointers Helped (Legacy Failed, Bullet Succeeded)\n")
        if lexical_helped:
            for c in lexical_helped:
                f.write(f"- **[{c['id']}]** *{c['question']}* (Expected: `{c['expected']}`)\n")
        else:
            f.write("*None*\n")
        f.write("\n")

        f.write("### Cases Where Bullet Pointers Hurt (Legacy Succeeded, Bullet Failed)\n")
        if lexical_hurt:
            for c in lexical_hurt:
                f.write(f"- **[{c['id']}]** *{c['question']}* (Expected: `{c['expected']}`)\n")
        else:
            f.write("*None*\n")
        f.write("\n")

        f.write("### Cases Where Both Failed\n")
        if both_failed:
            for c in both_failed:
                f.write(f"- **[{c['id']}]** *{c['question']}* (Expected: `{c['expected']}`)\n")
        else:
            f.write("*None*\n")
        f.write("\n")

        # Failure samples
        f.write("### Strict VAMP Failure Samples\n")
        if strict_failures:
            for c in strict_failures[:5]:
                f.write(f"- **[{c['id']}]** *{c['question']}* (Expected: `{c['expected']}`)\n")
        else:
            f.write("*None*\n")
        f.write("\n")

        f.write("### VAMP v2 Failure Samples\n")
        if lexical_failures:
            for c in lexical_failures[:5]:
                f.write(f"- **[{c['id']}]** *{c['question']}* (Expected: `{c['expected']}`)\n")
        else:
            f.write("*None*\n")
        f.write("\n")

    print(f"Markdown report written to: {report_path}")
    print("\nBenchmark Execution Complete.")

if __name__ == "__main__":
    asyncio.run(main())
