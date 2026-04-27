import os
import sys
from unittest.mock import MagicMock

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

try:
    from lib.storage import upload_file
    print("[OK] Successfully imported upload_file from lib.storage")
except Exception as e:
    print(f"[ERR] Failed to import from lib.storage: {e}")
    try:
        from _storage_fallback import upload_file
        print("[OK] Successfully imported upload_file from _storage_fallback")
    except Exception as e2:
        print(f"[ERR] Failed to import from _storage_fallback: {e2}")
        sys.exit(1)

# Mock file object
mock_file = MagicMock()
mock_file.filename = "test.png"
mock_file.content_type = "image/png"
mock_file.file.seek = MagicMock()

# Mock os.getenv to avoid Cloudinary for this test
os.environ["CLOUDINARY_URL"] = ""

try:
    url = upload_file(mock_file, folder="test_folder")
    print(f"[OK] upload_file returned: {url}")
    
    # Check if /tmp/test_folder exists
    if os.path.exists("/tmp/test_folder"):
        print("[OK] /tmp/test_folder created")
    else:
        # On Windows, /tmp might not exist, but os.path.join("/tmp", folder) might create it relative to root?
        # Actually on Windows it might be C:\tmp or something.
        print(f"[INFO] /tmp/test_folder not found, but this is expected on Windows if not configured. Check path: {os.path.abspath('/tmp/test_folder')}")

except Exception as e:
    print(f"[ERR] upload_file failed: {e}")
