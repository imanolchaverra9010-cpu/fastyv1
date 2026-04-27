"""
Fallback storage module in case lib.storage can't be imported.
Identical logic, placed at backend root for reliable import.
"""
import os
import uuid
import shutil

def upload_file(file_obj, folder: str = "fasty") -> str:
    # 1. Try Cloudinary
    cloudinary_url = os.getenv("CLOUDINARY_URL")
    if cloudinary_url:
        try:
            import cloudinary
            import cloudinary.uploader
            
            # Forzar configuración
            cloudinary.config(from_url=cloudinary_url)
            
            file_obj.file.seek(0)
            result = cloudinary.uploader.upload(
                file_obj.file, 
                folder=f"fasty/{folder}",
                public_id=f"{uuid.uuid4().hex[:8]}"
            )
            url = result.get("secure_url")
            if url:
                return url
        except Exception as e:
            print(f"Cloudinary failed: {e}")
            raise Exception(f"Cloudinary Error: {str(e)}")

    # 2. Fallback /tmp
    try:
        local_dir = os.path.join("/tmp", folder)
        os.makedirs(local_dir, exist_ok=True)
        ext = "jpg"
        if hasattr(file_obj, 'filename') and file_obj.filename and "." in file_obj.filename:
            ext = file_obj.filename.split(".")[-1]
        filename = f"{uuid.uuid4().hex[:8]}.{ext}"
        file_path = os.path.join(local_dir, filename)
        file_obj.file.seek(0)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file_obj.file, buffer)
        return f"/static/{folder}/{filename}"
    except Exception as e:
        raise Exception(f"Upload failed: {e}")
