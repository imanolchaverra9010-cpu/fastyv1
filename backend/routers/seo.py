import os
from datetime import datetime, timezone
from typing import Optional
from xml.sax.saxutils import escape

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse, Response

from database import get_db

router = APIRouter(tags=["SEO"])

SITE_URL = os.getenv("SITE_URL", "https://fasty-delta.vercel.app").rstrip("/")

STATIC_PAGES = [
    ("/", "daily", "1.0"),
    ("/negocios", "daily", "0.9"),
    ("/pedido-abierto", "weekly", "0.8"),
    ("/viajes", "weekly", "0.7"),
    ("/negocios/registro", "monthly", "0.6"),
    ("/conductor/registro", "monthly", "0.5"),
    ("/soporte", "monthly", "0.5"),
    ("/politica-de-privacidad", "yearly", "0.3"),
    ("/terminos-y-condiciones", "yearly", "0.3"),
]

ROBOTS_DISALLOW = [
    "/admin",
    "/admin/",
    "/login",
    "/checkout",
    "/payment/",
    "/perfil",
    "/domiciliario",
    "/negocio",
    "/conductor/viajes",
    "/rastreo/",
    "/viajes/seguir/",
    "/api/",
]


def _url_entry(path: str, changefreq: str, priority: str, lastmod: Optional[str] = None) -> str:
    loc = f"{SITE_URL}{path}"
    lastmod_tag = f"\n    <lastmod>{lastmod}</lastmod>" if lastmod else ""
    return (
        f"  <url>\n"
        f"    <loc>{escape(loc)}</loc>{lastmod_tag}\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        f"  </url>"
    )


def build_sitemap_xml() -> str:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    entries = [_url_entry(path, freq, prio, today) for path, freq, prio in STATIC_PAGES]

    db = get_db()
    if db:
        cursor = db.cursor(dictionary=True)
        try:
            cursor.execute(
                """
                SELECT id, created_at
                FROM businesses
                WHERE status = 'active'
                ORDER BY rating DESC
                LIMIT 500
                """
            )
            for row in cursor.fetchall():
                business_id = row.get("id")
                if not business_id:
                    continue
                created = row.get("created_at")
                lastmod = created.strftime("%Y-%m-%d") if hasattr(created, "strftime") else today
                entries.append(_url_entry(f"/negocios/{business_id}", "weekly", "0.8", lastmod))
        finally:
            cursor.close()
            db.close()

    body = "\n".join(entries)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}\n"
        "</urlset>"
    )


def build_robots_txt() -> str:
    lines = [
        "# Robots rules for Fasty",
        "User-agent: *",
        "Allow: /",
    ]
    lines.extend(f"Disallow: {rule}" for rule in ROBOTS_DISALLOW)
    lines.extend(
        [
            "",
            f"Sitemap: {SITE_URL}/sitemap.xml",
        ]
    )
    return "\n".join(lines) + "\n"


@router.get("/sitemap.xml")
def sitemap_xml():
    xml = build_sitemap_xml()
    return Response(
        content=xml,
        media_type="application/xml; charset=utf-8",
        headers={"Cache-Control": "public, max-age=3600, s-maxage=3600"},
    )


@router.get("/robots.txt")
def robots_txt():
    return PlainTextResponse(
        build_robots_txt(),
        headers={"Cache-Control": "public, max-age=86400, s-maxage=86400"},
    )
