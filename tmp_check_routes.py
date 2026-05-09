import sys
from pathlib import Path
sys.path.insert(0, str(Path('api').resolve()))
sys.path.insert(0, str(Path('backend').resolve()))
import api.index as index
app = index.app
print('Routes:')
for route in app.routes:
    print(route.path, getattr(route, 'methods', None))
