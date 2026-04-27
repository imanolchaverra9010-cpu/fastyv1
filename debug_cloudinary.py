import os
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

def test_cloudinary():
    # 1. Cargar .env
    load_dotenv()
    
    url = os.getenv("CLOUDINARY_URL")
    
    if not url:
        print("❌ ERROR: No se encontró la variable CLOUDINARY_URL en el archivo .env")
        return

    print(f"--- Diagnóstico de Cloudinary ---")
    print(f"URL detectada: {url[:20]}...{url[-5:]}")
    
    try:
        # 2. Configurar
        cloudinary.config(from_url=url, secure=True)
        
        # 3. Intentar subida de prueba
        print("Subiendo imagen de prueba (Logo de Google)...")
        result = cloudinary.uploader.upload(
            "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png",
            folder="debug_test",
            public_id="test_connection"
        )
        
        print("\n✅ ¡CONEXIÓN EXITOSA!")
        print(f"ID Público: {result['public_id']}")
        print(f"URL de imagen: {result['secure_url']}")
        print("\nSi ves esto, tus credenciales son correctas. Asegúrate de que sean las mismas que pusiste en Vercel.")

    except Exception as e:
        print("\n❌ FALLÓ LA CONEXIÓN")
        print(f"Mensaje de error: {str(e)}")
        
        if "Invalid Credentials" in str(e):
            print("👉 El API Key o el API Secret son incorrectos.")
        elif "Cloud name" in str(e):
            print("👉 El nombre de la nube (Cloud Name) es incorrecto.")
        elif "Configuration required" in str(e):
            print("👉 La URL no tiene el formato correcto.")
            
if __name__ == "__main__":
    test_cloudinary()
