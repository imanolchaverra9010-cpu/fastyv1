import os
import uuid
import shutil

def upload_file(file_obj, folder: str = "fasty") -> str:
    """
    Uploads a file to Cloudinary or falls back to /tmp.
    file_obj: a FastAPI UploadFile object
    """
    
    # 1. Try Cloudinary
    cloudinary_url = os.getenv("CLOUDINARY_URL")
    if cloudinary_url:
        try:
            import cloudinary
            import cloudinary.uploader
            
            # Forzar configuración explícita
            # Intentar configurar desde URL pero también forzar parámetros si es necesario
            cloudinary.config(from_url=cloudinary_url, secure=True)
            
            file_obj.seek(0)
            upload_result = cloudinary.uploader.upload(
                file_obj.file, 
                folder=f"fasty/{folder}",
                public_id=f"{uuid.uuid4().hex[:8]}"
            )
            url = upload_result.get("secure_url")
            if url:
                print(f"Cloudinary upload OK: {url}")
                return url
        except Exception as e:
            print(f"Cloudinary upload failed: {e}")
            raise Exception(f"Cloudinary Error: {str(e)}")


    # 2. Fallback to /tmp (ephemeral on Vercel but works for dev)
    try:
        local_dir = os.path.join("/tmp", folder)
        os.makedirs(local_dir, exist_ok=True)
        
        ext = "jpg"
        if file_obj.filename and "." in file_obj.filename:
            ext = file_obj.filename.split(".")[-1]
        
        filename = f"{uuid.uuid4().hex[:8]}.{ext}"
        file_path = os.path.join(local_dir, filename)
        
        file_obj.seek(0)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file_obj.file, buffer)
            
        print(f"Local upload OK: {file_path}")
        return f"/static/{folder}/{filename}"
    except Exception as e:
        print(f"Local fallback failed: {e}")
        raise Exception(f"Could not upload file: {e}")
