import os
import json
from pathlib import Path

import fnmatch

UNKNOWN_MODEL_CONTEXT_WINDOW_TOKENS = 32768

def get_model_context_window_with_source(model_id: str) -> tuple[int, str]:
    """Resolve context window and its resolution source."""
    # Config file configuration
    config_path = Path("config/model_context_windows.json")
    if not config_path.is_absolute():
        # Resolve relative to project root
        config_path = Path(__file__).parent.parent.parent / "config" / "model_context_windows.json"
    
    config_windows = {}
    if config_path.exists():
        try:
            with open(config_path, "r") as f:
                config_windows = json.load(f)
        except json.JSONDecodeError:
            pass

    if isinstance(config_windows, dict) and "models" in config_windows:
        config_windows = config_windows["models"]
    if not isinstance(config_windows, dict):
        config_windows = {}

    if model_id in config_windows:
        val = config_windows[model_id]
        print(f"model_id: {model_id}")
        print(f"resolved_context_window: {val}")
        print(f"resolution_source: config_file")
        return val, "config_file"

    for pattern, v in config_windows.items():
        if fnmatch.fnmatch(model_id, pattern):
            print(f"model_id: {model_id}")
            print(f"resolved_context_window: {v}")
            print(f"resolution_source: wildcard")
            return v, "wildcard"

    for k, v in config_windows.items():
        if k in model_id or model_id in k:
            print(f"model_id: {model_id}")
            print(f"resolved_context_window: {v}")
            print(f"resolution_source: wildcard")
            return v, "wildcard"

    # Fallback
    print(f"model_id: {model_id}")
    print(f"resolved_context_window: {UNKNOWN_MODEL_CONTEXT_WINDOW_TOKENS}")
    print(f"resolution_source: fallback")
    return UNKNOWN_MODEL_CONTEXT_WINDOW_TOKENS, "fallback"

def get_model_context_window(model_id: str) -> int:
    """Resolve context window using selected model_id."""
    val, _ = get_model_context_window_with_source(model_id)
    return val

def calculate_token_budget(model_id: str) -> dict:
    """Calculate token budget based on context window."""
    model_context_window, resolution_source = get_model_context_window_with_source(model_id)
    
    reserved_system_tokens = int(os.getenv("RESERVED_SYSTEM_TOKENS", 1000))
    reserved_vamp_memory_tokens = int(os.getenv("RESERVED_VAMP_MEMORY_TOKENS", 3000))
    reserved_tool_schema_tokens = int(os.getenv("RESERVED_TOOL_SCHEMA_TOKENS", 2000))
    reserved_output_tokens = int(os.getenv("RESERVED_OUTPUT_TOKENS", 4000))
    reserved_safety_margin_tokens = int(os.getenv("RESERVED_SAFETY_MARGIN_TOKENS", 500))
    
    usable_input_budget = (
        model_context_window
        - reserved_system_tokens
        - reserved_vamp_memory_tokens
        - reserved_tool_schema_tokens
        - reserved_output_tokens
        - reserved_safety_margin_tokens
    )
    
    if usable_input_budget < 1000:
        usable_input_budget = 1000  # Floor
        
    utilization_ratio = float(os.getenv("ACTIVE_CONTEXT_UTILIZATION_RATIO", 0.80))
    active_context_budget = int(usable_input_budget * utilization_ratio)
    
    return {
        "model_context_window": model_context_window,
        "resolution_source": resolution_source,
        "reserved_system_tokens": reserved_system_tokens,
        "reserved_vamp_memory_tokens": reserved_vamp_memory_tokens,
        "reserved_tool_schema_tokens": reserved_tool_schema_tokens,
        "reserved_output_tokens": reserved_output_tokens,
        "reserved_safety_margin_tokens": reserved_safety_margin_tokens,
        "usable_input_budget": usable_input_budget,
        "active_context_budget": active_context_budget
    }

def estimate_tokens(text: str) -> int:
    """Rough estimation of tokens for a string."""
    if not text:
        return 0
    return len(str(text)) // 4
