"""HTTP cache header helpers for public API responses."""

from typing import Optional

from fastapi import Response


def apply_public_cache(
    response: Response,
    max_age: int = 60,
    s_maxage: Optional[int] = None,
    stale_while_revalidate: int = 0,
) -> None:
    edge_ttl = s_maxage if s_maxage is not None else max_age
    parts = ["public", f"max-age={max_age}", f"s-maxage={edge_ttl}"]
    if stale_while_revalidate > 0:
        parts.append(f"stale-while-revalidate={stale_while_revalidate}")
    response.headers["Cache-Control"] = ", ".join(parts)


def apply_private_cache(response: Response, max_age: int = 10) -> None:
    response.headers["Cache-Control"] = f"private, max-age={max_age}"


def apply_no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"


# TTL presets (seconds)
TTL_SHORT = 30
TTL_MEDIUM = 120
TTL_BUSINESSES = 300
TTL_MENU = 600
TTL_BANNERS = 300
TTL_PROMOTIONS = 180
TTL_THEME = 300
TTL_MAINTENANCE = 60
TTL_SEO = 3600
