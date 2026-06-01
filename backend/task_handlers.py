"""Registered async task handlers."""

from __future__ import annotations

import logging

from async_jobs import register_handler
from cache import delete_cache
from database import get_db

logger = logging.getLogger(__name__)

websocket_manager = None


def set_websocket_manager(manager) -> None:
    global websocket_manager
    websocket_manager = manager


def _handle_push_send(payload: dict) -> None:
    from routers.push import send_push_notification

    user_id = payload.get("user_id")
    message = payload.get("message") or {}
    if user_id:
        send_push_notification(int(user_id), message)


async def _handle_order_notify_created(payload: dict) -> None:
    from routers.push import send_push_notification

    if not payload.get("should_notify_couriers"):
        return

    notification_data = payload.get("notification_data") or {}

    if websocket_manager:
        await websocket_manager.notify_couriers(notification_data)
        business_id = payload.get("business_id")
        if business_id and payload.get("notify_business"):
            biz_notif = {**notification_data, "order_id": payload.get("order_id")}
            await websocket_manager.notify_business(business_id, biz_notif)

    business_owner_id = payload.get("business_owner_id")
    customer_name = payload.get("customer_name") or "Cliente"
    if business_owner_id:
        send_push_notification(int(business_owner_id), {
            "title": "¡Nuevo Pedido!",
            "body": f"Has recibido un nuevo pedido de {customer_name}.",
            "url": "/negocio/pedidos",
        })

    order_type = payload.get("order_type") or "regular"
    business_name = notification_data.get("business_name") or "Negocio"
    delivery_address = payload.get("delivery_address") or ""
    validated_total = int(payload.get("validated_total") or 0)

    db = get_db()
    if not db:
        return
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT DISTINCT c.user_id
            FROM couriers c
            INNER JOIN push_subscriptions ps ON ps.user_id = c.user_id
            WHERE c.user_id IS NOT NULL
            """
        )
        couriers = cursor.fetchall() or []
    finally:
        cursor.close()
        db.close()

    push_title = (
        f"Nuevo encargo: {business_name}"
        if order_type == "open"
        else f"Nuevo pedido: {business_name}"
    )
    push_body = (
        f"Destino: {delivery_address}"
        if order_type == "open"
        else f"Destino: {delivery_address} | Valor aprox: ${validated_total}"
    )

    for courier in couriers:
        user_id = courier.get("user_id")
        if user_id:
            send_push_notification(int(user_id), {
                "title": push_title,
                "body": push_body,
                "url": "/domiciliario",
            })


def _handle_cache_invalidate(payload: dict) -> None:
    pattern = payload.get("pattern") or "*"
    delete_cache(pattern)


def _handle_order_status_notify(payload: dict) -> None:
    from routers.push import send_push_notification

    targets = payload.get("targets") or []
    for target in targets:
        user_id = target.get("user_id")
        message = target.get("message")
        if user_id and message:
            send_push_notification(int(user_id), message)


def register_all_handlers() -> None:
    register_handler("push.send", _handle_push_send)
    register_handler("order.notify_created", _handle_order_notify_created)
    register_handler("order.status_notify", _handle_order_status_notify)
    register_handler("cache.invalidate", _handle_cache_invalidate)


register_all_handlers()
