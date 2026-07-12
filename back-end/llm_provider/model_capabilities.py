"""Configured Bedrock model capabilities used across provider integrations."""

from __future__ import annotations

import fnmatch
import json
from functools import lru_cache
from pathlib import Path

from config import get_config

_GEOGRAPHY_PREFIXES = ("us.", "eu.", "apac.", "ap.")


def normalize_model_id(model_id: str | None) -> str:
    """Normalize a Bedrock model ID for capability lookup.

    Strips a leading geography prefix (``us.``, ``eu.``, ``apac.``, ``ap.``)
    and any ARN/base-model path prefix (everything before the last ``/``)
    so callers can match catalog entries with the bare model suffix.

    Args:
        model_id: Raw model ID, ARN, or ``None``.

    Returns:
        The normalized model ID (empty string for ``None``/blank input).
    """
    value = str(model_id or "").strip()
    if "/" in value:
        value = value.rsplit("/", 1)[-1]
    for prefix in _GEOGRAPHY_PREFIXES:
        if value.startswith(prefix):
            return value[len(prefix) :]
    return value


@lru_cache(maxsize=1)
def load_model_capabilities() -> dict:
    """Load the model-capabilities catalog from JSON.

    Loads the bundled ``model_capabilities.json`` shipped with the package,
    then overlays any overrides from the path configured via
    ``Config.MODEL_CONTEXT_WINDOWS_PATH``. Per-model overrides are deep-merged
    on top of the bundled entry so deployments can patch individual fields
    without replacing the whole catalog. The result is cached for the
    process lifetime via :func:`functools.lru_cache`.

    Returns:
        Mapping of model ID (or glob pattern) to capability dict.
    """
    bundled_path = Path(__file__).with_name("model_capabilities.json")
    configured = _read_capability_file(bundled_path)

    config = get_config()
    config_path = Path(config.MODEL_CONTEXT_WINDOWS_PATH)
    if not config_path.is_absolute():
        config_path = Path(__file__).parent.parent / config_path
    if config_path != bundled_path:
        for model_id, override in _read_capability_file(config_path).items():
            if isinstance(configured.get(model_id), dict) and isinstance(override, dict):
                configured[model_id] = {**configured[model_id], **override}
            else:
                configured[model_id] = override
    return configured


def _read_capability_file(config_path: Path) -> dict:
    """Read a capabilities JSON file, returning ``{}`` on missing/invalid input.

    Accepts either a top-level ``{"models": {...}}`` wrapper or a bare
    ``{model_id: capabilities}`` mapping.
    """
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
    """Resolve capabilities for ``model_id`` with a source label.

    Lookup order:

    1. Exact match on the raw ``model_id`` or its normalized form.
    2. Glob pattern (``fnmatch``) match against configured keys.
    3. Substring containment in either direction (lenient fallback).

    Args:
        model_id: Bedrock model ID, ARN, or geography-prefixed variant.

    Returns:
        A ``(capabilities, source)`` tuple. ``capabilities`` is the matched
        capability dict (``{}`` when nothing matched). ``source`` is one of
        ``"config_file"`` (exact match), ``"wildcard"`` (pattern/substring
        match), or ``"fallback"`` (no match).
    """
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
    """Return a single capability value for ``model_id``.

    Args:
        model_id: Bedrock model ID, ARN, or geography-prefixed variant.
        name: Capability key to look up (e.g. ``"context_window"``,
            ``"max_output_tokens"``, ``"reasoning_type"``).
        default: Value returned when the capability is absent.

    Returns:
        The capability value, or ``default`` if not found.
    """
    capabilities, _source = get_model_capabilities(model_id)
    return capabilities.get(name, default)


def _as_capability_dict(entry) -> dict:
    """Coerce a raw catalog entry into a capability dict.

    A bare integer is interpreted as the context window size; anything that
    cannot be coerced yields ``{}``.
    """
    if isinstance(entry, dict):
        return dict(entry)
    try:
        return {"context_window": int(entry)}
    except (TypeError, ValueError):
        return {}
