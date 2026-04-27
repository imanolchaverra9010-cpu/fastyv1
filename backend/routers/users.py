from fastapi import APIRouter, HTTPException, Depends
from typing import List
from database import get_db
from datetime import datetime

from schemas import UserUpdate

router = APIRouter()

@router.patch("/{user_id}")
def update_user(user_id: int, user_data: UserUpdate):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        updates = []
        params = []
        if user_data.username:
            updates.append("username = %s")
            params.append(user_data.username)
        if user_data.email:
            updates.append("email = %s")
            params.append(user_data.email)
        if user_data.avatar_url:
            updates.append("avatar_url = %s")
            params.append(user_data.avatar_url)
        if user_data.password:
            from utils import hash_password
            updates.append("password_hash = %s")
            params.append(hash_password(user_data.password))
            
        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")
            
        query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
        params.append(user_id)
        
        cursor.execute(query, params)
        db.commit()
        
        # Obtener el usuario actualizado
        cursor.execute("SELECT id, username, email, role, avatar_url FROM users WHERE id = %s", (user_id,))
        updated_user = cursor.fetchone()
        return updated_user
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@router.get("/{user_id}/benefits")
def get_user_benefits(user_id: int):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        # Contar pedidos entregados del usuario
        cursor.execute("SELECT COUNT(*) as total FROM orders WHERE user_id = %s AND status = 'delivered'", (user_id,))
        count = cursor.fetchone()['total']
        
        # Nivel basado en pedidos (1 nivel por cada 5 pedidos)
        level = 1 + (count // 5)
        
        benefits = []
        
        # Fetch used coupons
        cursor.execute("SELECT code FROM used_coupons WHERE user_id = %s", (user_id,))
        used_coupons_rows = cursor.fetchall()
        used_codes = {row['code'] for row in used_coupons_rows}

        # Generar sufijo único usando el user_id para evitar que se compartan
        unique_suffix = f"-U{user_id}X{(user_id * 73) % 99}"
        
        # Lógica de beneficios
        if count >= 1:
            code = f"BIENVENIDO10{unique_suffix}"
            if code not in used_codes:
                benefits.append({
                    "code": code,
                    "description": "10% de descuento en tu próximo pedido por ser nuevo.",
                    "discount": 10,
                    "type": "welcome"
                })
            
        if count >= 5:
            code = f"LEAL20{unique_suffix}"
            if code not in used_codes:
                benefits.append({
                    "code": code,
                    "description": "20% de descuento por tus primeros 5 pedidos.",
                    "discount": 20,
                    "type": "loyalty"
                })
            
        if count >= 10:
            code = f"PREMIUM50{unique_suffix}"
            if code not in used_codes:
                benefits.append({
                    "code": code,
                    "description": "¡WOW! 50% de descuento en tu próximo domicilio.",
                    "discount": 50,
                    "type": "premium"
                })
            
        return {
            "order_count": count,
            "level": level,
            "benefits": benefits
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
