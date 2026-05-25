import math
from fastapi import HTTPException
from utils import calculate_distance, get_bogota_time


def get_delivery_fee_by_distance(distance_km: float) -> int:
    if distance_km <= 2:
        return 5000
    if distance_km <= 4:
        return 8000
    if distance_km <= 6:
        return 10000
    if distance_km <= 8:
        return 12000
    if distance_km <= 10:
        return 15000
    return int(math.ceil(distance_km * 1500))


def is_night_fee_time() -> bool:
    hour = get_bogota_time().hour
    return hour >= 19 or hour < 6


def _user_benefit_suffix(user_id: int) -> str:
    return f"-U{user_id}X{(user_id * 73) % 99}"


def validate_promo_code(cursor, promo_code: str | None, user_id: int | None, business_id: str | None) -> int:
    """Returns discount percent applied to delivery fee (0 if no promo)."""
    if not promo_code or not str(promo_code).strip():
        return 0

    code = str(promo_code).strip().upper()

    if not user_id:
        raise HTTPException(status_code=400, detail="Debes iniciar sesión para usar un cupón")

    benefit_rules = (
        ("BIENVENIDO10", 1, 10),
        ("LEAL20", 5, 20),
        ("PREMIUM50", 10, 50),
    )
    for prefix, min_orders, discount in benefit_rules:
        expected = f"{prefix}{_user_benefit_suffix(user_id)}"
        if code == expected:
            cursor.execute(
                "SELECT COUNT(*) AS cnt FROM orders WHERE user_id = %s AND status NOT IN ('cancelled')",
                (user_id,),
            )
            order_count = int(cursor.fetchone()["cnt"] or 0)
            if order_count < min_orders:
                raise HTTPException(status_code=400, detail="No cumples los requisitos para este cupón")
            cursor.execute("SELECT id FROM used_coupons WHERE user_id = %s AND code = %s", (user_id, code))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Ya usaste este código de promoción")
            return discount

    if not business_id:
        raise HTTPException(status_code=400, detail="Código de promoción inválido")

    cursor.execute(
        """
        SELECT discount_percent FROM promotions
        WHERE UPPER(promo_code) = %s
          AND business_id = %s
          AND is_active = TRUE
          AND (expires_at IS NULL OR expires_at > NOW())
        """,
        (code, business_id),
    )
    promo = cursor.fetchone()
    if not promo or not promo.get("discount_percent"):
        raise HTTPException(status_code=400, detail="Código de promoción inválido o no activo")

    cursor.execute("SELECT id FROM used_coupons WHERE user_id = %s AND code = %s", (user_id, code))
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="Ya usaste este código de promoción")

    return int(promo["discount_percent"])


def _resolve_menu_prices(cursor, business_id: str, items: list) -> tuple[int, list]:
    cursor.execute(
        "SELECT name, price FROM menu_items WHERE business_id = %s AND is_active = TRUE",
        (business_id,),
    )
    menu_prices = {row["name"].strip().lower(): int(row["price"]) for row in cursor.fetchall()}

    subtotal = 0
    validated_items = []
    for item in items:
        key = item.name.strip().lower()
        if key not in menu_prices:
            raise HTTPException(status_code=400, detail=f"Producto no válido: {item.name}")
        server_price = menu_prices[key]
        qty = max(1, int(item.quantity))
        subtotal += server_price * qty
        validated_items.append(
            {
                "name": item.name,
                "price": server_price,
                "quantity": qty,
                "emoji": item.emoji,
            }
        )
    return subtotal, validated_items


def _calculate_delivery_fees(cursor, order) -> tuple[int, int]:
    delivery_fee = max(0, int(order.delivery_fee or 0))
    night_fee = max(0, int(order.night_fee or 0))

    if order.order_type in ("open", "business_requested"):
        return delivery_fee, night_fee

    if not order.business_id:
        return delivery_fee, night_fee

    cursor.execute(
        "SELECT latitude, longitude FROM businesses WHERE id = %s",
        (order.business_id,),
    )
    business = cursor.fetchone()
    if not business or order.latitude is None or order.longitude is None:
        return delivery_fee, night_fee

    distance = calculate_distance(
        float(business["latitude"]),
        float(business["longitude"]),
        float(order.latitude),
        float(order.longitude),
    )
    calculated_delivery = get_delivery_fee_by_distance(distance)
    calculated_night = 2000 if is_night_fee_time() else 0

    if order.batch_id:
        sent_total = delivery_fee + night_fee
        if sent_total == 2000:
            return 2000, 0
        if abs(sent_total - (calculated_delivery + calculated_night)) <= 100:
            return delivery_fee, night_fee
        return calculated_delivery, calculated_night

    if abs((delivery_fee + night_fee) - (calculated_delivery + calculated_night)) <= 100:
        return delivery_fee, night_fee
    return calculated_delivery, calculated_night


def compute_order_pricing(cursor, order) -> dict:
    if order.order_type in ("open", "business_requested"):
        items_subtotal = sum(max(0, int(item.price)) * max(1, int(item.quantity)) for item in order.items)
        validated_items = [
            {
                "name": item.name,
                "price": int(item.price),
                "quantity": max(1, int(item.quantity)),
                "emoji": item.emoji,
            }
            for item in order.items
        ]
    else:
        if not order.business_id:
            raise HTTPException(status_code=400, detail="business_id es obligatorio")
        if not order.items:
            raise HTTPException(status_code=400, detail="El pedido debe incluir al menos un producto")
        items_subtotal, validated_items = _resolve_menu_prices(cursor, order.business_id, order.items)

    delivery_fee, night_fee = _calculate_delivery_fees(cursor, order)
    fee_before_discount = delivery_fee + night_fee
    discount_percent = validate_promo_code(cursor, order.promo_code, order.user_id, order.business_id)
    discount_amount = min(fee_before_discount, int(fee_before_discount * discount_percent / 100)) if discount_percent else 0
    total = items_subtotal + fee_before_discount - discount_amount

    return {
        "items_subtotal": items_subtotal,
        "delivery_fee": delivery_fee,
        "night_fee": night_fee,
        "discount_percent": discount_percent,
        "discount_amount": discount_amount,
        "total": total,
        "validated_items": validated_items,
        "promo_code": order.promo_code.strip().upper() if order.promo_code and discount_percent else None,
    }
