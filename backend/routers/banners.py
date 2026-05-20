from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
from security import get_current_user

router = APIRouter()

# Schema definitions
class BannerBase(BaseModel):
    slot_position: str  # 'left', 'right_top', 'right_bottom'
    tag: Optional[str] = None
    title: str
    subtitle: Optional[str] = None
    button_text: Optional[str] = None
    redirect_url: Optional[str] = None
    image_url: str
    bg_gradient: Optional[str] = None
    text_color: Optional[str] = "text-white"
    is_active: Optional[bool] = True

class BannerCreate(BannerBase):
    pass

class BannerUpdate(BaseModel):
    slot_position: Optional[str] = None
    tag: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    button_text: Optional[str] = None
    redirect_url: Optional[str] = None
    image_url: Optional[str] = None
    bg_gradient: Optional[str] = None
    text_color: Optional[str] = None
    is_active: Optional[bool] = None

class BannerResponse(BannerBase):
    id: int

# Auto create table function
def init_banners_table():
    conn = get_db()
    if not conn:
        print("Error: No se pudo conectar a la base de datos para inicializar home_banners")
        return
    cursor = conn.cursor()
    try:
        sql = """
        CREATE TABLE IF NOT EXISTS home_banners (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slot_position VARCHAR(50) NOT NULL,
            tag VARCHAR(100) NULL,
            title VARCHAR(255) NOT NULL,
            subtitle VARCHAR(255) NULL,
            button_text VARCHAR(100) NULL,
            redirect_url VARCHAR(500) NULL,
            image_url VARCHAR(500) NOT NULL,
            bg_gradient VARCHAR(255) NULL,
            text_color VARCHAR(100) DEFAULT 'text-white',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        """
        cursor.execute(sql)
        conn.commit()
        print("Tabla 'home_banners' inicializada exitosamente.")
    except Exception as e:
        print(f"Error al crear tabla home_banners: {e}")
    finally:
        cursor.close()
        conn.close()

# Call the initialization on module load
init_banners_table()

# --- Endpoints ---

@router.get("/active", response_model=List[BannerResponse])
def get_active_banners():
    conn = get_db()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM home_banners WHERE is_active = TRUE ORDER BY id DESC")
        banners = cursor.fetchall()
        return banners
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/admin", response_model=List[BannerResponse])
def get_admin_banners(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")
    conn = get_db()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM home_banners ORDER BY id DESC")
        banners = cursor.fetchall()
        return banners
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.post("/admin", response_model=BannerResponse)
def create_banner(banner: BannerCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")
    conn = get_db()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = conn.cursor(dictionary=True)
    try:
        sql = """
        INSERT INTO home_banners (slot_position, tag, title, subtitle, button_text, redirect_url, image_url, bg_gradient, text_color, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(sql, (
            banner.slot_position,
            banner.tag,
            banner.title,
            banner.subtitle,
            banner.button_text,
            banner.redirect_url,
            banner.image_url,
            banner.bg_gradient,
            banner.text_color,
            banner.is_active
        ))
        conn.commit()
        banner_id = cursor.lastrowid
        
        cursor.execute("SELECT * FROM home_banners WHERE id = %s", (banner_id,))
        return cursor.fetchone()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.put("/admin/{banner_id}", response_model=BannerResponse)
def update_banner(banner_id: int, banner: BannerUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")
    conn = get_db()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM home_banners WHERE id = %s", (banner_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Banner no encontrado")
        
        update_data = banner.dict(exclude_unset=True)
        if not update_data:
            return existing
            
        fields = ", ".join([f"{k} = %s" for k in update_data.keys()])
        values = list(update_data.values())
        values.append(banner_id)
        
        sql = f"UPDATE home_banners SET {fields} WHERE id = %s"
        cursor.execute(sql, values)
        conn.commit()
        
        cursor.execute("SELECT * FROM home_banners WHERE id = %s", (banner_id,))
        return cursor.fetchone()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.delete("/admin/{banner_id}")
def delete_banner(banner_id: int, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")
    conn = get_db()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM home_banners WHERE id = %s", (banner_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Banner no encontrado")
        
        cursor.execute("DELETE FROM home_banners WHERE id = %s", (banner_id,))
        conn.commit()
        return {"detail": "Banner eliminado exitosamente"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.post("/admin/upload-image")
async def upload_banner_image(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")
        
    try:
        from lib.storage import upload_file
    except ImportError:
        from _storage_fallback import upload_file
        
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Formato de imagen no permitido. Usa JPG, PNG, WebP o GIF.")
        
    try:
        image_url = upload_file(file, folder="banners")
        return {"image_url": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir imagen: {str(e)}")
