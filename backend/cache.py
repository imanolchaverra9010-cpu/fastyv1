import os
import json
import logging

try:
    import redis
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    # Initialize connection pool
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1)
    # Test connection quickly
    redis_client.ping()
    CACHE_ENABLED = True
    logging.info("Redis cache enabled.")
except Exception as e:
    CACHE_ENABLED = False
    redis_client = None
    logging.warning(f"Redis cache disabled. Could not connect to Redis: {e}")

def get_cache(key: str):
    """Get value from cache. Returns None if not found or cache disabled."""
    if not CACHE_ENABLED or not redis_client:
        return None
    try:
        val = redis_client.get(key)
        if val:
            return json.loads(val)
        return None
    except Exception as e:
        logging.error(f"Redis get error for {key}: {e}")
        return None

def set_cache(key: str, data: dict | list, ttl_seconds: int = 300):
    """Set value in cache with a TTL (default 5 minutes)."""
    if not CACHE_ENABLED or not redis_client:
        return False
    try:
        redis_client.setex(key, ttl_seconds, json.dumps(data))
        return True
    except Exception as e:
        logging.error(f"Redis set error for {key}: {e}")
        return False

def delete_cache(key_pattern: str):
    """Delete all keys matching pattern (e.g. 'businesses*')."""
    if not CACHE_ENABLED or not redis_client:
        return False
    try:
        # Avoid keys() in prod if possible, but safe for small data.
        # scan_iter is better.
        cursor = 0
        deleted = 0
        for key in redis_client.scan_iter(match=key_pattern):
            redis_client.delete(key)
            deleted += 1
        return deleted > 0
    except Exception as e:
        logging.error(f"Redis delete error for {key_pattern}: {e}")
        return False
