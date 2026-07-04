---
name: react-flow-diagram
description: Produce grounded React Flow artifacts for schemas, ERDs, relationships, query plans, and workflows.
when_to_use: The requested output is a diagram, ERD, schema map, relationship graph, node/edge visualization, workflow graph, or diagram-flow artifact.
avoid_when: The user only asks for textual explanation, SQL/query results, or schema facts without requesting a visual artifact.
---

# React Flow Diagram

Produce high-quality, grounded diagrams as JSON inside a fenced `diagram-flow` block. Always gather evidence from tools first, then apply a consistent color system and layout strategy.

## JSON Specification

Every diagram is a single JSON object inside `​```diagram-flow`. All fields the renderer accepts:

```diagram-flow
{
  "direction": "LR",                       // LR | TB | RL | BT (see Layout Strategies)
  "nodes": [
    {
      "id": "users",                       // unique, stable, semantic id (NOT node1)
      "type": "entity",                    // entity|process|decision|data|input|output|aggregate|join|scan|filter|sort|group
      "label": "users",                    // primary title — short
      "subtitle": "Account records",       // secondary description (optional)
      "count": 12453,                      // row count ONLY from get_table_row_count
      "status": "ready",                   // ready|running|success|error|warning|pending|cached
      "tags": ["indexed"],                 // short flags
      "columns": [                         // REQUIRED for entity/ERD nodes
        {"name": "id", "type": "uuid", "key": "PK", "nullable": false},
        {"name": "email", "type": "varchar(255)", "key": "UNIQUE", "nullable": false}
      ],
      "style": {
        "backgroundColor": "#10b981",      // from palette below
        "color": "#ffffff",                // text color
        "borderColor": "#059669",
        "borderStyle": "solid",            // solid|dashed|dotted
        "borderWidth": "2px",
        "borderRadius": "8px"              // 8px for entities, 0px for process/decision
      }
    }
  ],
  "edges": [
    {
      "id": "fk_orders_user",              // semantic edge id
      "source": "orders",                  // must match a node id
      "target": "users",                   // must match a node id
      "label": "FK: user_id → users.id",
      "type": "smoothstep",                // floating|smoothstep|straight|step
      "dashed": false,                     // true for optional/soft relations
      "animated": true,                    // true for FKs and important flows
      "style": {"stroke": "#6b7280", "strokeWidth": "2.5px"}
    }
  ]
}
```

Do not use layout-breaking CSS inside `style`: `position`, `display`, `zIndex`, `width`, `height`.

## Node Type Reference

| Type | Use For | Default Color | Border Radius |
|------|---------|---------------|---------------|
| `entity` | DB tables, domain objects | blue `#3b82f6` | 8px |
| `process` | Transform / pipeline step | gray `#6b7280` | 0px |
| `decision` | Branch / conditional | amber `#f59e0b` | 0px |
| `data` | Intermediate data store | purple `#8b5cf6` | 8px |
| `input` | Source / trigger | green `#10b981` | 8px |
| `output` | Sink / final result | blue `#3b82f6` | 8px |
| `scan` | Table scan (query plan) | red `#ef4444` | 0px |
| `join` | Join operation | blue `#3b82f6` | 0px |
| `aggregate` | GROUP BY | purple `#8b5cf6` | 0px |
| `filter` | WHERE clause | amber `#f59e0b` | 0px |
| `sort` | ORDER BY | orange `#f59e0b` | 0px |
| `group` | GROUP node | purple `#8b5cf6` | 0px |

## Color System

Use these semantic colors. Do not invent hex codes.

| Meaning | Color | Hex |
|---------|-------|-----|
| Primary entity | blue | `#3b82f6` |
| Success / safe / input | emerald | `#10b981` |
| Warning / decision | amber | `#f59e0b` |
| Error / expensive | red | `#ef4444` |
| Neutral / process | gray | `#6b7280` |
| Accent / aggregate | purple | `#8b5cf6` |

**Schema domain coloring** (overrides the default entity blue):
- User/auth tables → green `#10b981`
- Transaction/order tables → blue `#3b82f6`
- Billing/payment tables → purple `#8b5cf6`
- Audit/log tables → gray `#6b7280`
- Config/metadata tables → amber `#f59e0b`

Always pair a saturated background with white (`#ffffff`) text.

## Layout Strategies

| Direction | When to Use |
|-----------|-------------|
| `LR` (left→right) | Wide schemas (≤8 tables), linear pipelines, ERDs with many columns |
| `TB` (top→bottom) | Deep query plans, branching workflows, tall hierarchies, schemas with >8 tables |
| `RL` (right→left) | Rare — only for right-to-left reading order |
| `BT` (bottom→top) | Rare — only for bottom-up dependency graphs |

## Diagram Types

### A. Schema / ERD
- `entity` nodes; `label` = table name, `subtitle` = primary purpose, `columns` = full column list with types and key flags (PK / FK / UNIQUE / indexed).
- Animated edges for FKs; `label` = `"FK: col → ref_table.col"`.
- Color tables by domain (see Color System).
- `LR` for ≤8 tables, `TB` for >8 tables.
- **Grounding:** call `get_schema_overview` first; `count` only from `get_table_row_count`.

### B. Query Execution Plan
- `scan` (red) for seq scans, `index` style green for index scans (use `entity` with green fill if no `index` type), `join` (blue), `aggregate` (purple), `filter` (amber), `sort` (orange).
- `TB` (root op at top, leaf scans at bottom) or `LR`.
- `label` each node with operation + estimated cost from `explain_query`.
- Edge `label` = estimated rows.
- Color code: red = expensive (seq scan on large table), green = efficient (index scan), amber = moderate.
- **Grounding:** call `explain_query(query)` first; never invent plan nodes.

### C. Workflow / Pipeline
- `process` for steps, `decision` for branches, `data` for inputs/outputs, `input` (green) for sources, `output` (blue) for sinks.
- `LR` for linear pipelines, `TB` for branching workflows.
- Edge labels = data flow (e.g., `"row batch"`, `"aggregated result"`).
- If steps are not in context, ask the user.

### D. Relationship Graph (non-schema)
- For concepts, people, or entities outside the DB.
- `entity` nodes with meaningful `tags`. Animate the most important relationship edges.

### E. Data Flow / Architecture
- `input`, `process`, `data`, `output` nodes showing how data moves through the system.

## Grounding Rules (anti-hallucination)

- ALWAYS call `get_schema_overview(target_tables?)` before an ERD — never invent tables, columns, or relationships.
- Call `get_foreign_keys(table_name)` if FKs are not in the overview.
- Call `get_table_row_count(table_name)` to populate `count` — never guess.
- Call `explain_query(query)` before a query-plan diagram — never invent plan nodes.
- "My schema" / "entire schema" → include every table from `get_schema_overview` (cap 50).
- Subset → explicitly state: `"Showing N of M tables: [list]. Omitted: [list or 'many']."`
- Never invent row counts, index names, table names, columns, or relationships.
- Edges must exactly match known relationships — do not infer FKs from column names.

## Agent Workflow

1. **Classify** the diagram type (ERD / query plan / workflow / relationship / data flow).
2. **Gather evidence** with the right tools (ERD → overview + FKs + optional counts; query plan → `explain_query`; workflow → ask user if absent).
3. **Choose direction** per Layout Strategies.
4. **Apply colors** per Color System and diagram type.
5. **Build JSON** with semantic IDs, complete `columns` for ERDs, valid edges.
6. **Output ONLY the `diagram-flow` block first** — no prose before it.
7. **After the diagram**, add 1–3 sentences explaining what it shows and any key insights.

## Validation Checklist (self-check before output)

- All node IDs are unique and semantic (`users`, not `node1`).
- All edge `source`/`target` values match existing node IDs.
- `columns` present on every `entity` node.
- `count` only set when a real row count was retrieved.
- ≤30 nodes total (split or subset if more).
- Direction matches the layout rules.
- Colors come from the defined palette.
- No prose before the `diagram-flow` block.

## Anti-Patterns (AVOID)

- Inventing tables, columns, FKs, or row counts not returned by tools.
- Using `node1`, `node2` style IDs.
- Producing a diagram without first calling the grounding tools.
- Including >50 nodes (unreadable) — split or focus on a subset.
- Mixing diagram types (query-plan nodes in an ERD, etc.).
- Outputting prose before the diagram block.
- Using random hex colors instead of the palette.
