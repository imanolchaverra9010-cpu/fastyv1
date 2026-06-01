from fastapi import APIRouter, HTTPException, Depends, Response
from typing import List
from database import get_db
import schemas
from security import get_current_user, assert_business_owner
from cache import get_or_set_cache, delete_cache
from http_cache import TTL_PROMOTIONS, apply_public_cache

router = APIRouter()


@router.post("/", response_model=schemas.PromotionResponse)
def create_promotion(
    promotion: schemas.PromotionCreate,
    business_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = conn.cursor(dictionary=True)
    try:
        assert_business_owner(cursor, business_id, current_user)
        sql = """
        INSERT INTO promotions (business_id, title, description, discount_percent, promo_code, image_url, emoji, is_active, expires_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(
            sql,
            (
                business_id,
                promotion.title,
                promotion.description,
                promotion.discount_percent,
                promotion.promo_code,
                promotion.image_url,
                promotion.emoji,
                promotion.is_active,
                promotion.expires_at,
            ),
        )
        conn.commit()

        promotion_id = cursor.lastrowid
        cursor.execute("SELECT * FROM promotions WHERE id = %s", (promotion_id,))
        delete_cache("promotions:*")
        return cursor.fetchone()
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@router.get("/{business_id}", response_model=List[schemas.PromotionResponse])
def get_business_promotions(business_id: str, response: Response, only_active: bool = True):
    apply_public_cache(response, max_age=120, s_maxage=120, stale_while_revalidate=180)

    def load():
        conn = get_db()
        if not conn:
            raise HTTPException(status_code=500, detail="Database connection failed")
        cursor = conn.cursor(dictionary=True)
        try:
            sql = "SELECT * FROM promotions WHERE business_id = %s"
            if only_active:
                sql += " AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())"
            cursor.execute(sql, (business_id,))
            return cursor.fetchall()
        finally:
            cursor.close()
            conn.close()

    cache_key = f"promotions:business:{business_id}:{'active' if only_active else 'all'}"
    data, _ = get_or_set_cache(cache_key, load, TTL_PROMOTIONS)
    return data


@router.get("", response_model=List[schemas.PromotionResponse])
@router.get("/", response_model=List[schemas.PromotionResponse])
def get_all_active_promotions(response: Response):
    apply_public_cache(response, max_age=120, s_maxage=120, stale_while_revalidate=180)

    def load():
        conn = get_db()
        if not conn:
            raise HTTPException(status_code=500, detail="Database connection failed")
        cursor = conn.cursor(dictionary=True)
        try:
            sql = "SELECT * FROM promotions WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())"
            cursor.execute(sql)
            return cursor.fetchall()
        finally:
            cursor.close()
            conn.close()

    data, _ = get_or_set_cache("promotions:active:all", load, TTL_PROMOTIONS)
    return data


@router.put("/{promotion_id}", response_model=schemas.PromotionResponse)
def update_promotion(
    promotion_id: int,
    promotion: schemas.PromotionUpdate,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM promotions WHERE id = %s", (promotion_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Promotion not found")

        assert_business_owner(cursor, existing["business_id"], current_user)

        update_data = promotion.dict(exclude_unset=True)
        if not update_data:
            return existing

        fields = ", ".join([f"{k} = %s" for k in update_data.keys()])
        values = list(update_data.values())
        values.append(promotion_id)

        sql = f"UPDATE promotions SET {fields} WHERE id = %s"
        cursor.execute(sql, values)
        conn.commit()

        cursor.execute("SELECT * FROM promotions WHERE id = %s", (promotion_id,))
        delete_cache("promotions:*")
        return cursor.fetchone()
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@router.delete("/{promotion_id}")
def delete_promotion(promotion_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT business_id FROM promotions WHERE id = %s", (promotion_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Promotion not found")
        assert_business_owner(cursor, existing["business_id"], current_user)
        cursor.execute("DELETE FROM promotions WHERE id = %s", (promotion_id,))
        conn.commit()
        delete_cache("promotions:*")
        return {"detail": "Promotion deleted"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()
