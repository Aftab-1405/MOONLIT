"""
LangGraph checkpointing — thread persistence for conversation state.

- Development: ``InMemorySaver`` (in-process; lost on restart unless Firestore seeds).
- Staging/production: ``AsyncRedisSaver`` with Redis URL from the environment.

``AsyncRedisSaver.from_conn_string`` is an async context manager only; for a
process-wide saver we construct ``AsyncRedisSaver(redis_url=...)`` and enter it
once at FastAPI lifespan (see ``main.py``), then close on shutdown.

Reference: https://docs.langchain.com/oss/python/langgraph/persistence
"""

from __future__ import annotations

import logging
import os
import json
import asyncio
from typing import TYPE_CHECKING, Optional, AsyncIterator, Any, Dict, List, Tuple, Union, cast

from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import (
    BaseCheckpointSaver,
    Checkpoint,
    CheckpointMetadata,
    ChannelVersions,
    CheckpointTuple,
    get_checkpoint_id,
    PendingWrite,
)
from langgraph.constants import TASKS
from langgraph.checkpoint.redis.base import BaseRedisSaver
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.redis.aio import AsyncRedisSaver
from langgraph.checkpoint.redis.util import (
    to_storage_safe_id,
    to_storage_safe_str,
    from_storage_safe_id,
    from_storage_safe_str,
    EMPTY_ID_SENTINEL,
)
from langgraph.checkpoint.redis.key_registry import (
    AsyncCheckpointKeyRegistry as AsyncKeyRegistry,
)

logger = logging.getLogger(__name__)


class UpstashRedisSaver(AsyncRedisSaver):
    """
    Custom Redis checkpointer that bypasses SearchIndex creation and search commands (FT.*),
    making it fully compatible with Upstash Redis or standard Redis instances without Redis Stack modules.
    """

    async def asetup(self) -> None:
        """Set up the checkpointer event loop and detect cluster mode, skipping search index setup."""
        self.loop = asyncio.get_running_loop()
        await self._detect_cluster_mode()
        self._key_registry = AsyncKeyRegistry(self._redis)

    async def aput(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
        stream_mode: str = "values",
    ) -> RunnableConfig:
        """Store a checkpoint to Redis using JSON.SET and EXPIRE, avoiding SearchIndex."""
        configurable = config["configurable"].copy()

        run_id = configurable.pop("run_id", metadata.get("run_id"))
        thread_id = configurable.pop("thread_id")
        checkpoint_ns = configurable.pop("checkpoint_ns")
        config_checkpoint_id = configurable.pop("checkpoint_id", None)
        thread_ts = configurable.pop("thread_ts", "")

        checkpoint_id = config_checkpoint_id or thread_ts or checkpoint.get("id", "")

        parent_checkpoint_id = None
        if (
            checkpoint.get("id")
            and config_checkpoint_id
            and checkpoint.get("id") != config_checkpoint_id
        ):
            parent_checkpoint_id = config_checkpoint_id
            checkpoint_id = checkpoint["id"]

        storage_safe_thread_id = to_storage_safe_id(thread_id)
        storage_safe_checkpoint_ns = to_storage_safe_str(checkpoint_ns)
        storage_safe_checkpoint_id = to_storage_safe_id(checkpoint_id)

        copy = checkpoint.copy()
        next_config = {
            "configurable": {
                "thread_id": thread_id,
                "checkpoint_ns": checkpoint_ns,
                "checkpoint_id": checkpoint_id,
            }
        }

        try:
            checkpoint_ts = None
            if checkpoint_id:
                try:
                    from ulid import ULID
                    ulid_obj = ULID.from_str(checkpoint_id)
                    checkpoint_ts = ulid_obj.timestamp
                except Exception:
                    import time
                    checkpoint_ts = time.time() * 1000

            checkpoint_data = {
                "thread_id": storage_safe_thread_id,
                "run_id": to_storage_safe_id(run_id) if run_id else "",
                "checkpoint_ns": storage_safe_checkpoint_ns,
                "checkpoint_id": storage_safe_checkpoint_id,
                "parent_checkpoint_id": (
                    to_storage_safe_id(parent_checkpoint_id)
                    if parent_checkpoint_id
                    else ""
                ),
                "checkpoint_ts": checkpoint_ts,
                "checkpoint": self._dump_checkpoint(copy),
                "metadata": self._dump_metadata(metadata),
                "has_writes": False,
            }

            if all(key in metadata for key in ["source", "step"]):
                checkpoint_data["source"] = metadata["source"]
                checkpoint_data["step"] = metadata["step"]

            checkpoint_key = self._make_redis_checkpoint_key_cached(
                thread_id,
                checkpoint_ns,
                checkpoint_id,
            )

            ttl_seconds = None
            if self.ttl_config and "default_ttl" in self.ttl_config:
                ttl_seconds = int(self.ttl_config["default_ttl"] * 60)

            # Use direct JSON.SET instead of checkpoints_index.load
            await self._redis.json().set(checkpoint_key, "$", checkpoint_data)
            if ttl_seconds is not None:
                try:
                    await self._redis.expire(checkpoint_key, ttl_seconds)
                except Exception:
                    logger.warning("Failed to apply TTL to checkpoint key: %s", checkpoint_key)

            # Update latest checkpoint pointer
            latest_pointer_key = f"checkpoint_latest:{storage_safe_thread_id}:{storage_safe_checkpoint_ns}"
            await self._redis.set(latest_pointer_key, checkpoint_key)

            if ttl_seconds is not None:
                try:
                    await self._redis.expire(latest_pointer_key, ttl_seconds)
                except Exception:
                    logger.warning("Failed to apply TTL to latest pointer key: %s", latest_pointer_key)

            return next_config

        except asyncio.CancelledError:
            if stream_mode in ("values", "messages"):
                try:
                    checkpoint_data = {
                        "thread_id": storage_safe_thread_id,
                        "run_id": to_storage_safe_id(run_id) if run_id else "",
                        "checkpoint_ns": storage_safe_checkpoint_ns,
                        "checkpoint_id": storage_safe_checkpoint_id,
                        "parent_checkpoint_id": (
                            to_storage_safe_id(str(checkpoint.get("parent_checkpoint_id", "")))
                            if checkpoint.get("parent_checkpoint_id")
                            else ""
                        ),
                        "checkpoint": self._dump_checkpoint(copy),
                        "metadata": self._dump_metadata(
                            {
                                **metadata,
                                "interrupted": True,
                                "stream_mode": stream_mode,
                            }
                        ),
                        "has_writes": False,
                    }

                    checkpoint_key = self._make_redis_checkpoint_key(
                        storage_safe_thread_id,
                        storage_safe_checkpoint_ns,
                        storage_safe_checkpoint_id,
                    )

                    await self._redis.json().set(checkpoint_key, "$", checkpoint_data)
                except Exception:
                    pass
            raise

        except Exception as e:
            raise e

    async def aget_tuple(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        """Get a checkpoint tuple from Redis asynchronously."""
        thread_id = config["configurable"]["thread_id"]
        checkpoint_id = get_checkpoint_id(config)
        checkpoint_ns = config["configurable"].get("checkpoint_ns", "")

        storage_safe_thread_id = to_storage_safe_id(thread_id)
        storage_safe_checkpoint_ns = to_storage_safe_str(checkpoint_ns)

        if checkpoint_id and checkpoint_id != EMPTY_ID_SENTINEL:
            storage_safe_checkpoint_id = to_storage_safe_id(checkpoint_id)

            checkpoint_key = self._make_redis_checkpoint_key(
                storage_safe_thread_id,
                storage_safe_checkpoint_ns,
                storage_safe_checkpoint_id,
            )

            pipeline = self._redis.pipeline(transaction=False)
            pipeline.json().get(checkpoint_key, "$")

            if self.ttl_config and self.ttl_config.get("refresh_on_read"):
                pipeline.ttl(checkpoint_key)

            pipeline_results = await pipeline.execute()

            checkpoint_data_result = pipeline_results[0]
            checkpoint_data = checkpoint_data_result[0] if isinstance(checkpoint_data_result, list) and len(checkpoint_data_result) > 0 else checkpoint_data_result
            if not checkpoint_data:
                return None

            current_ttl = None
            if self.ttl_config and self.ttl_config.get("refresh_on_read"):
                current_ttl = pipeline_results[1]

            doc = {
                "thread_id": checkpoint_data.get("thread_id", storage_safe_thread_id),
                "checkpoint_ns": checkpoint_data.get(
                    "checkpoint_ns", storage_safe_checkpoint_ns
                ),
                "checkpoint_id": checkpoint_data.get(
                    "checkpoint_id", storage_safe_checkpoint_id
                ),
                "parent_checkpoint_id": checkpoint_data.get(
                    "parent_checkpoint_id", storage_safe_checkpoint_id
                ),
                "$.checkpoint": json.dumps(checkpoint_data.get("checkpoint", {})),
                "$.metadata": checkpoint_data.get(
                    "metadata", "{}"
                ),
            }
        else:
            latest_pointer_key = f"checkpoint_latest:{storage_safe_thread_id}:{storage_safe_checkpoint_ns}"
            checkpoint_key = await self._redis.get(latest_pointer_key)
            if not checkpoint_key:
                return None

            pipeline = self._redis.pipeline(transaction=False)
            pipeline.json().get(checkpoint_key, "$")

            if self.ttl_config and self.ttl_config.get("refresh_on_read"):
                pipeline.ttl(checkpoint_key)

            pipeline_results = await pipeline.execute()

            checkpoint_data_result = pipeline_results[0]
            checkpoint_data = checkpoint_data_result[0] if isinstance(checkpoint_data_result, list) and len(checkpoint_data_result) > 0 else checkpoint_data_result
            if not checkpoint_data:
                return None

            current_ttl = None
            if self.ttl_config and self.ttl_config.get("refresh_on_read"):
                current_ttl = pipeline_results[1]

            doc = {
                "thread_id": checkpoint_data.get("thread_id", storage_safe_thread_id),
                "checkpoint_ns": checkpoint_data.get(
                    "checkpoint_ns", storage_safe_checkpoint_ns
                ),
                "checkpoint_id": checkpoint_data.get("checkpoint_id"),
                "parent_checkpoint_id": checkpoint_data.get("parent_checkpoint_id"),
                "$.checkpoint": json.dumps(checkpoint_data.get("checkpoint", {})),
                "$.metadata": checkpoint_data.get(
                    "metadata", "{}"
                ),
            }

        doc_thread_id = from_storage_safe_id(doc["thread_id"])
        doc_checkpoint_ns = from_storage_safe_str(doc["checkpoint_ns"])
        doc_checkpoint_id = from_storage_safe_id(doc["checkpoint_id"])
        doc_parent_checkpoint_id = from_storage_safe_id(doc["parent_checkpoint_id"])

        if self.ttl_config and self.ttl_config.get("refresh_on_read"):
            if "current_ttl" not in locals():
                checkpoint_key = self._make_redis_checkpoint_key(
                    to_storage_safe_id(doc_thread_id),
                    to_storage_safe_str(doc_checkpoint_ns),
                    to_storage_safe_id(doc_checkpoint_id),
                )
                current_ttl = await self._redis.ttl(checkpoint_key)

            if current_ttl > 0:
                write_keys = []
                if self._key_registry:
                    write_keys = await self._key_registry.get_write_keys(
                        doc_thread_id, doc_checkpoint_ns, doc_checkpoint_id
                    )

                await self._apply_ttl_to_keys(
                    checkpoint_key, write_keys if write_keys else None
                )

                if self._key_registry and self.ttl_config:
                    ttl_minutes = self.ttl_config.get("default_ttl")
                    if ttl_minutes is not None:
                        ttl_seconds = int(ttl_minutes * 60)
                        await self._key_registry.apply_ttl(
                            doc_thread_id,
                            doc_checkpoint_ns,
                            doc_checkpoint_id,
                            ttl_seconds,
                        )

        checkpoint_raw = (
            doc.get("$.checkpoint")
            if isinstance(doc, dict)
            else getattr(doc, "$.checkpoint", None)
        )
        if isinstance(checkpoint_raw, str):
            checkpoint_data_dict = json.loads(checkpoint_raw)
        else:
            checkpoint_data_dict = checkpoint_raw

        channel_versions_from_checkpoint = (
            checkpoint_data_dict.get("channel_versions")
            if checkpoint_data_dict
            else None
        )

        tasks: List[Any] = []

        tasks.append(
            self.aget_channel_values(
                thread_id=doc_thread_id,
                checkpoint_ns=doc_checkpoint_ns,
                checkpoint_id=doc_checkpoint_id,
                channel_versions=channel_versions_from_checkpoint,
            )
        )

        if doc_parent_checkpoint_id:
            tasks.append(
                self._aload_pending_sends(
                    thread_id=thread_id,
                    checkpoint_ns=doc_checkpoint_ns,
                    parent_checkpoint_id=doc_parent_checkpoint_id,
                )
            )

        tasks.append(
            self._aload_pending_writes(thread_id, checkpoint_ns, doc_checkpoint_id)
        )

        if doc_parent_checkpoint_id:
            results = await asyncio.gather(*tasks)
            channel_values: Dict[str, Any] = self._recursive_deserialize(results[0])
            pending_sends: List[Tuple[str, Union[str, bytes]]] = results[1]
            pending_writes: List[PendingWrite] = results[2]
        else:
            results = await asyncio.gather(*tasks)
            channel_values = self._recursive_deserialize(results[0])
            pending_sends = []
            pending_writes = results[1]

        raw_metadata = (
            doc.get("$.metadata", "{}")
            if isinstance(doc, dict)
            else getattr(doc, "$.metadata", "{}")
        )
        metadata_dict = (
            json.loads(raw_metadata) if isinstance(raw_metadata, str) else raw_metadata
        )

        sanitized_metadata = {
            k.replace("\u0000", ""): (
                v.replace("\u0000", "") if isinstance(v, str) else v
            )
            for k, v in metadata_dict.items()
        }
        metadata = cast(CheckpointMetadata, sanitized_metadata)

        config_param: RunnableConfig = {
            "configurable": {
                "thread_id": thread_id,
                "checkpoint_ns": checkpoint_ns,
                "checkpoint_id": doc_checkpoint_id,
            }
        }

        checkpoint_data_val = doc["$.checkpoint"]
        if isinstance(checkpoint_data_val, dict):
            checkpoint_data_val = json.dumps(checkpoint_data_val)

        checkpoint_param = self._load_checkpoint(
            checkpoint_data_val,
            channel_values,
            pending_sends,
        )

        parent_config: RunnableConfig | None = None
        if doc_parent_checkpoint_id:
            parent_config = {
                "configurable": {
                    "thread_id": thread_id,
                    "checkpoint_ns": checkpoint_ns,
                    "checkpoint_id": doc_parent_checkpoint_id,
                }
            }

        return CheckpointTuple(
            config=config_param,
            checkpoint=checkpoint_param,
            metadata=metadata,
            parent_config=parent_config,
            pending_writes=pending_writes,
        )

    async def alist(
        self,
        config: Optional[RunnableConfig],
        *,
        filter: Optional[dict[str, Any]] = None,
        before: Optional[RunnableConfig] = None,
        limit: Optional[int] = None,
    ) -> AsyncIterator[CheckpointTuple]:
        """List checkpoints matching the filters by scanning keys, bypassing FT.SEARCH."""
        thread_id = config["configurable"]["thread_id"] if config else "*"
        checkpoint_ns = config["configurable"].get("checkpoint_ns", "*") if config else "*"

        storage_safe_thread_id = to_storage_safe_id(thread_id) if thread_id != "*" else "*"
        storage_safe_checkpoint_ns = to_storage_safe_str(checkpoint_ns) if checkpoint_ns != "*" else "*"

        scan_pattern = f"{self._checkpoint_prefix}:{storage_safe_thread_id}:{storage_safe_checkpoint_ns}:*"

        keys = []
        async for key in self._redis.scan_iter(match=scan_pattern, count=100):
            keys.append(key)

        if not keys:
            return

        pipeline = self._redis.pipeline(transaction=False)
        for key in keys:
            pipeline.json().get(key, "$")
        results = await pipeline.execute()

        docs = []
        for key, checkpoint_data_result in zip(keys, results):
            checkpoint_data = checkpoint_data_result[0] if isinstance(checkpoint_data_result, list) and len(checkpoint_data_result) > 0 else checkpoint_data_result
            if not checkpoint_data:
                continue

            parts = key.split(self._separator)
            chk_id = parts[-1]

            if filter:
                matched = True
                for k, v in filter.items():
                    if k == "source" and checkpoint_data.get("source") != v:
                        matched = False
                    elif k == "step" and checkpoint_data.get("step") != v:
                        matched = False
                    elif k == "thread_id" and from_storage_safe_id(checkpoint_data.get("thread_id")) != v:
                        matched = False
                    elif k == "run_id" and from_storage_safe_id(checkpoint_data.get("run_id")) != v:
                        matched = False
                if not matched:
                    continue

            if before:
                before_checkpoint_id = get_checkpoint_id(before)
                if before_checkpoint_id and chk_id >= before_checkpoint_id:
                    continue

            docs.append((chk_id, key, checkpoint_data))

        docs.sort(key=lambda x: x[0], reverse=True)

        if limit:
            docs = docs[:limit]

        for chk_id, key, checkpoint_data in docs:
            doc = {
                "thread_id": checkpoint_data.get("thread_id"),
                "checkpoint_ns": checkpoint_data.get("checkpoint_ns"),
                "checkpoint_id": checkpoint_data.get("checkpoint_id"),
                "parent_checkpoint_id": checkpoint_data.get("parent_checkpoint_id", ""),
                "$.checkpoint": json.dumps(checkpoint_data.get("checkpoint", {})),
                "$.metadata": checkpoint_data.get("metadata", "{}"),
            }

            doc_thread_id = from_storage_safe_id(doc["thread_id"])
            doc_checkpoint_ns = from_storage_safe_str(doc["checkpoint_ns"])
            doc_checkpoint_id = from_storage_safe_id(doc["checkpoint_id"])
            doc_parent_checkpoint_id = from_storage_safe_id(doc["parent_checkpoint_id"])

            tasks = []
            checkpoint_raw = doc.get("$.checkpoint")
            checkpoint_data_dict = json.loads(checkpoint_raw) if isinstance(checkpoint_raw, str) else checkpoint_raw
            channel_versions_from_checkpoint = checkpoint_data_dict.get("channel_versions") if checkpoint_data_dict else None

            tasks.append(
                self.aget_channel_values(
                    thread_id=doc_thread_id,
                    checkpoint_ns=doc_checkpoint_ns,
                    checkpoint_id=doc_checkpoint_id,
                    channel_versions=channel_versions_from_checkpoint,
                )
            )

            if doc_parent_checkpoint_id and doc_parent_checkpoint_id != "None" and doc_parent_checkpoint_id != "":
                tasks.append(
                    self._aload_pending_sends(
                        thread_id=doc_thread_id,
                        checkpoint_ns=doc_checkpoint_ns,
                        parent_checkpoint_id=doc_parent_checkpoint_id,
                    )
                )
            else:
                tasks.append(asyncio.sleep(0, result=[]))

            tasks.append(
                self._aload_pending_writes(doc_thread_id, doc_checkpoint_ns, doc_checkpoint_id)
            )

            results = await asyncio.gather(*tasks)
            channel_values = self._recursive_deserialize(results[0])
            pending_sends = results[1]
            pending_writes = results[2]

            raw_metadata = doc.get("$.metadata", "{}")
            metadata_dict = json.loads(raw_metadata) if isinstance(raw_metadata, str) else raw_metadata
            metadata = cast(CheckpointMetadata, metadata_dict)

            config_param = {
                "configurable": {
                    "thread_id": doc_thread_id,
                    "checkpoint_ns": doc_checkpoint_ns,
                    "checkpoint_id": doc_checkpoint_id,
                }
            }

            checkpoint_param = self._load_checkpoint(
                doc["$.checkpoint"],
                channel_values,
                pending_sends,
            )

            parent_config = None
            if doc_parent_checkpoint_id and doc_parent_checkpoint_id != "None" and doc_parent_checkpoint_id != "":
                parent_config = {
                    "configurable": {
                        "thread_id": doc_thread_id,
                        "checkpoint_ns": doc_checkpoint_ns,
                        "checkpoint_id": doc_parent_checkpoint_id,
                    }
                }

            yield CheckpointTuple(
                config=config_param,
                checkpoint=checkpoint_param,
                metadata=metadata,
                parent_config=parent_config,
                pending_writes=pending_writes,
            )

    async def _aload_pending_sends(
        self,
        thread_id: str,
        checkpoint_ns: str = "",
        parent_checkpoint_id: str = "",
    ) -> List[Tuple[str, Union[str, bytes]]]:
        if not parent_checkpoint_id:
            return []

        if self._key_registry:
            write_count = await self._key_registry.get_write_count(
                thread_id, checkpoint_ns, parent_checkpoint_id
            )

            if write_count == 0:
                return []

            write_keys = await self._key_registry.get_write_keys(
                thread_id, checkpoint_ns, parent_checkpoint_id
            )

            task_write_keys = []
            for key in write_keys:
                if TASKS in key or "__pregel_tasks" in key:
                    task_write_keys.append(key)

            if not task_write_keys:
                return []

            pipeline = self._redis.pipeline(transaction=False)
            for key in task_write_keys:
                pipeline.json().get(key, "$")

            results = await pipeline.execute()

            pending_sends_with_sort_keys = []
            for write_data_result in results:
                write_data = write_data_result[0] if isinstance(write_data_result, list) and len(write_data_result) > 0 else write_data_result
                if write_data and write_data.get("channel") == TASKS:
                    pending_sends_with_sort_keys.append(
                        (
                            write_data.get("task_path", ""),
                            write_data.get("task_id", ""),
                            write_data.get("idx", 0),
                            write_data.get("type", ""),
                            write_data.get("blob", b""),
                        )
                    )

            pending_sends_with_sort_keys.sort(key=lambda x: (x[0], x[1], x[2]))
            return [(item[3], item[4]) for item in pending_sends_with_sort_keys]
        return []

    async def _aload_pending_writes(
        self,
        thread_id: str,
        checkpoint_ns: str = "",
        checkpoint_id: str = "",
    ) -> List[PendingWrite]:
        if checkpoint_id is None:
            return []

        if self._key_registry:
            write_count = await self._key_registry.get_write_count(
                thread_id, checkpoint_ns, checkpoint_id
            )

            if write_count == 0:
                return []

            write_keys = await self._key_registry.get_write_keys(
                thread_id, checkpoint_ns, checkpoint_id
            )

            pipeline = self._redis.pipeline(transaction=False)
            for key in write_keys:
                pipeline.json().get(key, "$")

            results = await pipeline.execute()

            writes_dict: Dict[Tuple[str, str], Dict[str, Any]] = {}

            for write_data_result in results:
                write_data = write_data_result[0] if isinstance(write_data_result, list) and len(write_data_result) > 0 else write_data_result
                if write_data:
                    task_id = write_data.get("task_id", "")
                    idx = str(write_data.get("idx", 0))
                    writes_dict[(task_id, idx)] = {
                        "task_id": task_id,
                        "idx": idx,
                        "channel": write_data.get("channel", ""),
                        "type": write_data.get("type", ""),
                        "blob": write_data.get("blob", b""),
                    }

            pending_writes = BaseRedisSaver._load_writes(self.serde, writes_dict)
            return pending_writes
        return []


_checkpointer: Optional[BaseCheckpointSaver] = None
_redis_saver: Optional[UpstashRedisSaver] = None


async def init_checkpointer(*, app_env: str, redis_url: str | None) -> None:
    """
    Initialize the global checkpointer. Call once from FastAPI lifespan startup.

    For staging/production, *redis_url* should be the same TLS-normalized URL
    used for sessions (e.g. Upstash ``rediss://``).
    """
    global _checkpointer, _redis_saver

    if _checkpointer is not None:
        logger.debug("Checkpointer already initialized; skipping")
        return

    env = (app_env or "development").lower()

    if env in ("production", "staging") and redis_url:
        try:
            saver = UpstashRedisSaver(redis_url=redis_url)
            await saver.__aenter__()
            _redis_saver = saver
            _checkpointer = saver
            logger.info("LangGraph checkpointer: UpstashRedisSaver (Upstash-backed)")
            return
        except Exception as e:
            logger.exception(
                "Redis checkpointer failed; falling back to InMemorySaver: %s", e
            )

    _checkpointer = InMemorySaver()
    logger.info("LangGraph checkpointer: InMemorySaver")


async def shutdown_checkpointer() -> None:
    """Close Redis connections if we own an UpstashRedisSaver."""
    global _checkpointer, _redis_saver

    if _redis_saver is not None:
        try:
            await _redis_saver.__aexit__(None, None, None)
        except Exception as e:
            logger.warning("Error closing UpstashRedisSaver: %s", e)
        _redis_saver = None

    _checkpointer = None


def get_checkpointer() -> BaseCheckpointSaver:
    """
    Return the process-wide checkpointer.

    In development, if lifespan did not call ``init_checkpointer``, this lazily
    constructs ``InMemorySaver`` so ad-hoc scripts still work. Staging/production
    must initialize via lifespan so Redis is used.
    """
    global _checkpointer

    if _checkpointer is not None:
        return _checkpointer

    env = os.getenv("APP_ENV", "development").lower()
    if env in ("production", "staging"):
        raise RuntimeError(
            "Checkpointer not initialized: ensure FastAPI lifespan calls "
            "init_checkpointer() before handling requests."
        )

    logger.warning(
        "Dev fallback: instantiating InMemorySaver without lifespan init "
        "(OK for local scripts; use lifespan in production)"
    )
    _checkpointer = InMemorySaver()
    return _checkpointer

