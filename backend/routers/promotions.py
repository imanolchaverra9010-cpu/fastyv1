from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from database import get_db
import schemas
from datetime import datetime

router = APIRouter()

@router.post("/", response_model=schemas.PromotionResponse)
def create_promotion(promotion: schemas.PromotionCreate, business_id: str):
    conn = get_db()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = conn.cursor(dictionary=True)
    try:
        sql = """
        INSERT INTO promotions (business_id, title, description, discount_percent, promo_code, image_url, emoji, is_active, expires_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(sql, (
            business_id,
            promotion.title,
            promotion.description,
            promotion.discount_percent,
            promotion.promo_code,
            promotion.image_url,
            promotion.emoji,
            promotion.is_active,
            promotion.expires_at
        ))
        conn.commit()
        
        promotion_id = cursor.lastrowid
        cursor.execute("SELECT * FROM promotions WHERE id = %s", (promotion_id,))
        new_promo = cursor.fetchone()
        
        return new_promo
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/{business_id}", response_model=List[schemas.PromotionResponse])
def get_business_promotions(business_id: str, only_active: bool = True):
    conn = get_db()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = conn.cursor(dictionary=True)
    try:
        sql = "SELECT * FROM promotions WHERE business_id = %s"
        if only_active:
            sql += " AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())"
        
        cursor.execute(sql, (business_id,))
        promotions = cursor.fetchall()
        return promotions
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/", response_model=List[schemas.PromotionResponse])
def get_all_active_promotions():
    conn = get_db()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = conn.cursor(dictionary=True)
    try:
        sql = "SELECT * FROM promotions WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())"
        cursor.execute(sql)
        promotions = cursor.fetchall()
        return promotions
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.put("/{promotion_id}", response_model=schemas.PromotionResponse)
def update_promotion(promotion_id: int, promotion: schemas.PromotionUpdate):
    conn = get_db()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = conn.cursor(dictionary=True)
    try:
        # Get existing promotion
        cursor.execute("SELECT * FROM promotions WHERE id = %s", (promotion_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Promotion not found")
        
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
        return cursor.fetchone()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.delete("/{promotion_id}")
def delete_promotion(promotion_id: int):
    conn = get_db()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM promotions WHERE id = %s", (promotion_id,))
        conn.commit()
        return {"detail": "Promotion deleted"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()
