import importlib

m = importlib.import_module('api.index')
print('OK')
print('TOTAL', len(m.app.routes))
print([r.path for r in m.app.routes if 'businesses' in r.path])
