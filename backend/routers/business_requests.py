from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
from database import get_db
from schemas import BusinessRequestCreate, BusinessRequestResponse
from utils import pwd_context
import json
import uuid

router = APIRouter()

@router.post("/requests", response_model=BusinessRequestResponse, status_code=status.HTTP_201_CREATED)
def create_business_request(request: BusinessRequestCreate):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        errors = {}
        
        # 1. Verificar si el email ya existe en la tabla de usuarios
        cursor.execute("SELECT id FROM users WHERE email = %s", (request.email,))
        if cursor.fetchone():
            errors["email"] = "Este email ya está registrado en la plataforma."

        # 2. Verificar duplicados en solicitudes (Nombre y Email)
        cursor.execute(
            "SELECT name, email FROM business_requests WHERE (name = %s OR email = %s) AND status != 'rejected'",
            (request.name, request.email)
        )
        conflicts = cursor.fetchall()
        for conflict in conflicts:
            if conflict['name'] == request.name:
                errors["name"] = "Ya existe una solicitud para un negocio con este nombre."
            if conflict['email'] == request.email:
                errors["email"] = "Ya existe una solicitud pendiente con este email."

        if errors:
            db.close()
            raise HTTPException(
                status_code=400, 
                detail={"message": "Existen errores en los datos proporcionados.", "fields": errors}
            )

        menu_json_str = json.dumps(request.menu_json) if request.menu_json else "[]"
        
        cursor.execute(
            """INSERT INTO business_requests (name, email, phone, address, category, password, description, menu_json) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (request.name, request.email, request.phone, request.address, 
             request.category, request.password, request.description, menu_json_str)
        )
        db.commit()
        
        req_id = cursor.lastrowid
        cursor.execute("SELECT * FROM business_requests WHERE id = %s", (req_id,))
        new_request = cursor.fetchone()
        
        # Parse menu_json back for response model
        if new_request['menu_json']:
            new_request['menu_json'] = json.loads(new_request['menu_json'])
        
        db.close()
        return new_request
    except HTTPException as he:
        raise he
    except Exception as e:
        if db.is_connected():
            db.rollback()
            db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/requests", response_model=List[BusinessRequestResponse])
def get_all_requests():
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM business_requests ORDER BY created_at DESC")
        requests = cursor.fetchall()
        for r in requests:
            if r['menu_json']:
                r['menu_json'] = json.loads(r['menu_json'])
        db.close()
        return requests
    except HTTPException as he:
        raise he
    except Exception as e:
        if db.is_connected():
            db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/requests/{request_id}/approve")
def approve_business_request(request_id: int):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        # 1. Obtener la solicitud
        cursor.execute("SELECT * FROM business_requests WHERE id = %s", (request_id,))
        req = cursor.fetchone()
        if not req:
            db.close()
            raise HTTPException(status_code=404, detail="Request not found")
        
        if req['status'] != 'pending':
            db.close()
            raise HTTPException(status_code=400, detail="Request is already processed")

        # 2. Crear el Usuario
        username = req['name'].lower().replace(" ", "")[:20] + str(uuid.uuid4())[:4]
        
        # Verificar duplicados antes de insertar
        cursor.execute("SELECT id FROM users WHERE email = %s OR username = %s", (req['email'], username))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="El email o nombre de usuario ya está registrado por otro negocio o usuario.")

        user_password = req['password'] if req['password'] else "rapidito2024"
        hashed_password = pwd_context.hash(user_password)
        
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, role) VALUES (%s, %s, %s, %s)",
            (username, req['email'], hashed_password, 'business')
        )
        owner_id = cursor.lastrowid

        # 3. Crear el Negocio
        biz_id = str(uuid.uuid4())[:8]
        cursor.execute(
            """INSERT INTO businesses (id, owner_id, name, description, category, address, phone, emoji, status) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (biz_id, owner_id, req['name'], req['description'], req['category'], 
             req['address'], req['phone'], '🏪', 'active')
        )

        # 4. Crear los Menu Items
        menu_json_raw = req['menu_json']
        if isinstance(menu_json_raw, str):
            menu_items = json.loads(menu_json_raw)
        else:
            menu_items = menu_json_raw if menu_json_raw else []
            
        for item in menu_items:
            # item format: {name, price, desc}
            price = int(item.get('price', 0))
            cursor.execute(
                """INSERT INTO menu_items (business_id, name, description, price, category, emoji) 
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (biz_id, item['name'], item['desc'], price, req['category'], '🍔')
            )

        # 5. Marcar solicitud como aprobada
        cursor.execute("UPDATE business_requests SET status = 'approved' WHERE id = %s", (request_id,))
        
        db.commit()
        db.close()
        return {"message": "Business request approved and created successfully", "username": username}
    except HTTPException as he:
        # Re-raise HTTP exceptions to let FastAPI handle them properly
        raise he
    except Exception as e:
        if db.is_connected():
            db.rollback()
            db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/requests/{request_id}/reject")
def reject_business_request(request_id: int):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("UPDATE business_requests SET status = 'rejected' WHERE id = %s", (request_id,))
        db.commit()
        db.close()
        return {"message": "Business request rejected"}
    except HTTPException as he:
        raise he
    except Exception as e:
        if db.is_connected():
            db.rollback()
            db.close()
        raise HTTPException(status_code=500, detail=str(e))
