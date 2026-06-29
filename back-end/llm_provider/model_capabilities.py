"""Configured Bedrock model capabilities used across provider integrations."""

from __future__ import annotations

import fnmatch
import json
from functools import lru_cache
from pathlib import Path

from config import get_config

_GEOGRAPHY_PREFIXES = ("us.", "eu.", "apac.", "ap.")


def normalize_model_id(model_id: str | None) -> str:
    value = str(model_id or "").strip()
    if "/" in value:
        value = value.rsplit("/", 1)[-1]
    for prefix in _GEOGRAPHY_PREFIXES:
        if value.startswith(prefix):
            return value[len(prefix) :]
    return value


@lru_cache(maxsize=1)
def load_model_capabilities() -> dict:
    bundled_path = Path(__file__).with_name("model_capabilities.json")
    configured = _read_capability_file(bundled_path)

    config = get_config()
    config_path = Path(config.MODEL_CONTEXT_WINDOWS_PATH)
    if not config_path.is_absolute():
        config_path = Path(__file__).parent.parent / config_path
    if config_path != bundled_path:
        for model_id, override in _read_capability_file(config_path).items():
            if isinstance(configured.get(model_id), dict) and isinstance(
                override, dict
            ):
                configured[model_id] = {**configured[model_id], **override}
            else:
                configured[model_id] = override
    return configured


def _read_capability_file(config_path: Path) -> dict:
    if not config_path.exists():
        return {}
    try:
        loaded = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if isinstance(loaded, dict) and "models" in loaded:
        loaded = loaded["models"]
    return loaded if isinstance(loaded, dict) else {}


def get_model_capabilities(model_id: str) -> tuple[dict, str]:
    configured = load_model_capabilities()
    normalized = normalize_model_id(model_id)
    if not normalized:
        return {}, "fallback"
    candidates = (str(model_id or ""), normalized)

    for candidate in candidates:
        entry = configured.get(candidate)
        if entry is not None:
            return _as_capability_dict(entry), "config_file"

    for pattern, entry in configured.items():
        if any(fnmatch.fnmatch(candidate, pattern) for candidate in candidates):
            return _as_capability_dict(entry), "wildcard"

    for configured_id, entry in configured.items():
        if configured_id in normalized or normalized in configured_id:
            return _as_capability_dict(entry), "wildcard"
    return {}, "fallback"


def model_capability(model_id: str, name: str, default=None):
    capabilities, _source = get_model_capabilities(model_id)
    return capabilities.get(name, default)


def _as_capability_dict(entry) -> dict:
    if isinstance(entry, dict):
        return dict(entry)
    try:
        return {"context_window": int(entry)}
    except (TypeError, ValueError):
        return {}
