from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db
import json
import os
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
if VAPID_EMAIL and not VAPID_EMAIL.startswith("mailto:"):
    VAPID_EMAIL = f"mailto:{VAPID_EMAIL}"

class PushSubscription(BaseModel):
    user_id: int
    subscription: dict

def _subscription_endpoint(subscription: dict) -> str | None:
    endpoint = subscription.get("endpoint")
    return endpoint if isinstance(endpoint, str) and endpoint else None

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
        return {"message": "Subscription saved"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

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
