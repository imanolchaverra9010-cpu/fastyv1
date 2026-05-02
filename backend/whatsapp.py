import os
import requests
from dotenv import load_dotenv

load_dotenv()

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")

def format_whatsapp_number(phone: str) -> str:
    """Asegura que el número tenga el prefijo de país (+57 para Colombia) y el formato correcto para WhatsApp."""
    if not phone:
        return ""
    
    # Limpiar espacios o caracteres extraños
    clean_phone = "".join(filter(str.isdigit, phone))
    
    # Si el número tiene 10 dígitos (típico celular en Colombia), le agregamos 57
    if len(clean_phone) == 10:
        clean_phone = f"57{clean_phone}"
    
    return f"whatsapp:+{clean_phone}"

def send_whatsapp_message(to_phone: str, message: str):
    """Envía un mensaje de WhatsApp usando la API de Twilio."""
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        print("⚠️ Twilio no configurado. Se saltó el envío de WhatsApp.")
        return False
        
    formatted_phone = format_whatsapp_number(to_phone)
    if not formatted_phone:
        return False

    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
    
    data = {
        "From": TWILIO_WHATSAPP_NUMBER,
        "To": formatted_phone,
        "Body": message
    }
    
    try:
        response = requests.post(url, data=data, auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN))
        if response.status_code in [200, 201]:
            print(f"✅ WhatsApp enviado exitosamente a {formatted_phone}")
            return True
        else:
            print(f"❌ Error enviando WhatsApp a {formatted_phone}: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Excepción enviando WhatsApp: {str(e)}")
        return False
