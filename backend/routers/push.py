from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from database import get_db
import json
import os
from urllib.parse import urlparse
try:
    from pywebpush import webpush, WebPushException
    PUSH_SUPPORTED = True
except ImportError:
    PUSH_SUPPORTED = False
    print("pywebpush not installed. Push notifications disabled.")

router = APIRouter()

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.getenv("VITE_VAPID_PUBLIC_KEY")
VAPID_EMAIL = os.getenv("VAPID_EMAIL", "mailto:admin@rapidito.com")
PUSH_DEBUG_TOKEN = os.getenv("PUSH_DEBUG_TOKEN")
if VAPID_EMAIL and not VAPID_EMAIL.startswith("mailto:"):
    VAPID_EMAIL = f"mailto:{VAPID_EMAIL}"

class PushSubscription(BaseModel):
    user_id: int
    subscription: dict

class PushTestRequest(BaseModel):
    user_id: int
    title: str = "Prueba Fasty"
    body: str = "Prueba de notificacion push"
    url: str = "/"

def _subscription_endpoint(subscription: dict) -> str | None:
    endpoint = subscription.get("endpoint")
    return endpoint if isinstance(endpoint, str) and endpoint else None

def _endpoint_provider(endpoint: str | None) -> str | None:
    if not endpoint:
        return None
    return urlparse(endpoint).netloc or None

def _require_debug_token(x_push_debug_token: str | None):
    if not PUSH_DEBUG_TOKEN or x_push_debug_token != PUSH_DEBUG_TOKEN:
        raise HTTPException(status_code=403, detail="Push diagnostics are not enabled")

@router.post("/subscribe")
def subscribe(data: PushSubscription):
    endpoint = _subscription_endpoint(data.subscription)
    if not endpoint:
        raise HTTPException(status_code=400, detail="Invalid push subscription endpoint")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    subscription_json = json.dumps(data.subscription)
    
    try:
        cursor.execute("SELECT id, subscription_json FROM push_subscriptions WHERE user_id = %s", (data.user_id,))
        stale_or_duplicate_ids = []
        for row in cursor.fetchall():
            try:
                saved_subscription = json.loads(row["subscription_json"])
            except Exception:
                stale_or_duplicate_ids.append(row["id"])
                continue

            if _subscription_endpoint(saved_subscription) == endpoint:
                stale_or_duplicate_ids.append(row["id"])

        if stale_or_duplicate_ids:
            placeholders = ",".join(["%s"] * len(stale_or_duplicate_ids))
            cursor.execute(f"DELETE FROM push_subscriptions WHERE id IN ({placeholders})", tuple(stale_or_duplicate_ids))

        cursor.execute(
            "INSERT INTO push_subscriptions (user_id, subscription_json) VALUES (%s, %s)",
            (data.user_id, subscription_json)
        )
        db.commit()
        return {
            "message": "Subscription saved",
            "user_id": data.user_id,
            "provider": _endpoint_provider(endpoint)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@router.get("/diagnostics/{user_id}")
def diagnostics(user_id: int, x_push_debug_token: str | None = Header(default=None)):
    _require_debug_token(x_push_debug_token)

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT subscription_json, created_at FROM push_subscriptions WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,)
        )
        rows = cursor.fetchall()
        providers = []
        for row in rows:
            try:
                endpoint = _subscription_endpoint(json.loads(row["subscription_json"]))
                provider = _endpoint_provider(endpoint)
                if provider and provider not in providers:
                    providers.append(provider)
            except Exception:
                continue

        return {
            "push_supported": PUSH_SUPPORTED,
            "vapid_private_key_configured": bool(VAPID_PRIVATE_KEY),
            "vapid_public_key_configured": bool(VAPID_PUBLIC_KEY),
            "vapid_email_configured": bool(VAPID_EMAIL),
            "subscription_count": len(rows),
            "providers": providers,
            "last_subscription_at": rows[0]["created_at"].isoformat() if rows else None
        }
    finally:
        cursor.close()
        db.close()

@router.post("/test")
def test_push(data: PushTestRequest, x_push_debug_token: str | None = Header(default=None)):
    _require_debug_token(x_push_debug_token)

    success = send_push_notification(data.user_id, {
        "title": data.title,
        "body": data.body,
        "url": data.url
    })

    return {"sent": success}

def send_push_notification(user_id: int, message_body: dict):
    if not PUSH_SUPPORTED:
        print("Push notifications skipped: pywebpush not installed.")
        return False

    if not VAPID_PRIVATE_KEY:
        print("Push notifications skipped: VAPID_PRIVATE_KEY is not configured.")
        return False
        
    db = get_db()
    if not db:
        return False
    
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, subscription_json FROM push_subscriptions WHERE user_id = %s", (user_id,))
    subscriptions = cursor.fetchall()
    
    if not subscriptions:
        cursor.close()
        db.close()
        return False

    success = False
    stale_ids = []
    for sub_row in subscriptions:
        try:
            subscription_info = json.loads(sub_row["subscription_json"])
            webpush(
                subscription_info=subscription_info,
                data=json.dumps(message_body),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_EMAIL}
            )
            success = True
        except WebPushException as ex:
            print(f"WebPush error: {ex}")
            # If the subscription is expired, we should delete it
            if ex.response and ex.response.status_code in [404, 410]:
                stale_ids.append(sub_row["id"])
        except Exception as e:
            print(f"Unexpected push error: {e}")

    if stale_ids:
        try:
            placeholders = ",".join(["%s"] * len(stale_ids))
            cursor.execute(f"DELETE FROM push_subscriptions WHERE id IN ({placeholders})", tuple(stale_ids))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Failed to delete stale push subscriptions: {e}")

    cursor.close()
    db.close()
    return success
