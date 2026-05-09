import sys
from pathlib import Path
log_path = Path('tmp_import_result.txt')
try:
    sys.path.insert(0, str(Path('backend').resolve()))
    import routers.businesses as b
    log_path.write_text('IMPORT_OK\n')
except Exception as e:
    log_path.write_text('IMPORT_FAIL\n' + repr(e) + '\n')
