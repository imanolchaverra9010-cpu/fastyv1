from fastapi import APIRouter, HTTPException, status, Depends
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

class PushSubscription(BaseModel):
    user_id: int
    subscription: dict

@router.post("/subscribe")
def subscribe(data: PushSubscription):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor()
    subscription_json = json.dumps(data.subscription)
    
    try:
        # Avoid duplicate subscriptions for the same user and endpoint
        # But for simplicity, we just insert or update
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
        db.close()

def send_push_notification(user_id: int, message_body: dict):
    if not PUSH_SUPPORTED:
        print("Push notifications skipped: pywebpush not installed.")
        return False
        
    db = get_db()
    if not db:
        return False
    
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT subscription_json FROM push_subscriptions WHERE user_id = %s", (user_id,))
    subscriptions = cursor.fetchall()
    db.close()
    
    if not subscriptions:
        return False

    success = False
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
                # Logic to delete stale subscription
                pass
        except Exception as e:
            print(f"Unexpected push error: {e}")
            
    return success
