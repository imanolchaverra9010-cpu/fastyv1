import fnmatch
import json
import logging
import os
import time
from datetime import date, datetime, timedelta
from decimal import Decimal
from threading import Lock
from typing import Any, Callable, Optional, Tuple

try:
    import redis

    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1)
    redis_client.ping()
    CACHE_ENABLED = True
    logging.info("Redis cache enabled.")
except Exception as e:
    CACHE_ENABLED = False
    redis_client = None
    logging.warning(f"Redis cache disabled. Using in-memory cache fallback: {e}")

_memory_store: dict[str, tuple[float, str]] = {}
_memory_lock = Lock()
_MEMORY_MAX_KEYS = 800


def _json_default(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, timedelta):
        return str(value)
    if isinstance(value, Decimal):
        return float(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def _serialize(data: Any) -> str:
    return json.dumps(data, default=_json_default)


def _memory_get(key: str) -> Optional[Any]:
    with _memory_lock:
        entry = _memory_store.get(key)
        if not entry:
            return None
        expires_at, payload = entry
        if time.time() > expires_at:
            _memory_store.pop(key, None)
            return None
        return json.loads(payload)


def _memory_set(key: str, data: Any, ttl_seconds: int) -> None:
    with _memory_lock:
        if len(_memory_store) >= _MEMORY_MAX_KEYS:
            now = time.time()
            expired = [k for k, (exp, _) in _memory_store.items() if exp <= now]
            for k in expired[:200]:
                _memory_store.pop(k, None)
            if len(_memory_store) >= _MEMORY_MAX_KEYS:
                oldest = sorted(_memory_store.items(), key=lambda item: item[1][0])[:100]
                for k, _ in oldest:
                    _memory_store.pop(k, None)
        _memory_store[key] = (time.time() + ttl_seconds, _serialize(data))


def _memory_delete_pattern(key_pattern: str) -> int:
    deleted = 0
    with _memory_lock:
        keys = [k for k in list(_memory_store.keys()) if fnmatch.fnmatch(k, key_pattern)]
        for key in keys:
            _memory_store.pop(key, None)
            deleted += 1
    return deleted


def get_cache(key: str) -> Optional[Any]:
    """Get value from Redis or in-memory cache."""
    if CACHE_ENABLED and redis_client:
        try:
            val = redis_client.get(key)
            if val:
                return json.loads(val)
        except Exception as e:
            logging.error(f"Redis get error for {key}: {e}")
    return _memory_get(key)


def set_cache(key: str, data: Any, ttl_seconds: int = 300) -> bool:
    """Set value in Redis and in-memory cache."""
    payload = _serialize(data)
    redis_ok = False
    if CACHE_ENABLED and redis_client:
        try:
            redis_client.setex(key, ttl_seconds, payload)
            redis_ok = True
        except Exception as e:
            logging.error(f"Redis set error for {key}: {e}")
    _memory_set(key, data, ttl_seconds)
    return redis_ok or True


def delete_cache(key_pattern: str) -> bool:
    """Delete keys matching pattern from Redis and memory."""
    deleted = False
    if CACHE_ENABLED and redis_client:
        try:
            for key in redis_client.scan_iter(match=key_pattern):
                redis_client.delete(key)
                deleted = True
        except Exception as e:
            logging.error(f"Redis delete error for {key_pattern}: {e}")
    if _memory_delete_pattern(key_pattern) > 0:
        deleted = True
    return deleted


def get_or_set_cache(key: str, loader: Callable[[], Any], ttl_seconds: int = 300) -> Tuple[Any, bool]:
    """Return cached value or load, store, and return fresh data. Second value = cache hit."""
    cached = get_cache(key)
    if cached is not None:
        return cached, True
    data = loader()
    set_cache(key, data, ttl_seconds)
    return data, False
