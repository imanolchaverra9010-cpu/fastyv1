"""
Script de Migración: Hostinger → TiDB Cloud
Ejecutar una vez que Hostinger desbloquee las conexiones (~1 hora)

USO: python migrate_to_tidb.py
"""
import mysql.connector
import sys

# ============ CONFIGURACIÓN ============
# Origen (Hostinger)
SOURCE = {
    "host": "82.197.82.29",
    "user": "u659323332_fasty",
    "password": "Fasty2026*",
    "database": "u659323332_fasty",
    "port": 3306
}

# Destino (TiDB Cloud) — RELLENAR CON TUS DATOS
DEST = {
    "host": "PEGAR_HOST_TIDB_AQUI",
    "user": "PEGAR_USER_TIDB_AQUI",
    "password": "PEGAR_PASSWORD_TIDB_AQUI",
    "database": "fasty",
    "port": 4000,
    "ssl_disabled": False
}
# =======================================

def get_create_table(cursor, table_name):
    cursor.execute(f"SHOW CREATE TABLE `{table_name}`")
    row = cursor.fetchone()
    return row[1]

def migrate():
    print("🔌 Conectando a Hostinger (origen)...")
    try:
        src = mysql.connector.connect(**SOURCE)
    except Exception as e:
        print(f"❌ No se pudo conectar a Hostinger: {e}")
        print("   Espera a que se resetee el límite de conexiones (1 hora)")
        sys.exit(1)
    
    print("🔌 Conectando a TiDB Cloud (destino)...")
    try:
        dst = mysql.connector.connect(**DEST)
    except Exception as e:
        print(f"❌ No se pudo conectar a TiDB: {e}")
        print("   Verifica las credenciales de DEST en este archivo")
        sys.exit(1)
    
    src_cursor = src.cursor()
    dst_cursor = dst.cursor()
    
    # Crear la base de datos si no existe
    try:
        dst_cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{DEST['database']}`")
        dst_cursor.execute(f"USE `{DEST['database']}`")
    except:
        dst_cursor.execute(f"USE `{DEST['database']}`")
    
    # 1. Obtener lista de tablas
    src_cursor.execute("SHOW TABLES")
    tables = [t[0] for t in src_cursor.fetchall()]
    print(f"\n📋 Tablas encontradas: {len(tables)}")
    for t in tables:
        print(f"   - {t}")
    
    # 2. Crear tablas en destino
    print("\n🏗️  Creando tablas en TiDB...")
    # Desactivar checks de FK para poder crear en cualquier orden
    dst_cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
    
    for table in tables:
        try:
            create_sql = get_create_table(src_cursor, table)
            # Drop si ya existe
            dst_cursor.execute(f"DROP TABLE IF EXISTS `{table}`")
            dst_cursor.execute(create_sql)
            print(f"   ✅ {table}")
        except Exception as e:
            print(f"   ⚠️  {table}: {e}")
    
    dst.commit()
    
    # 3. Migrar datos
    print("\n📦 Migrando datos...")
    for table in tables:
        try:
            src_cursor.execute(f"SELECT * FROM `{table}`")
            rows = src_cursor.fetchall()
            
            if not rows:
                print(f"   ⏭️  {table}: vacía")
                continue
            
            # Obtener nombres de columnas
            col_count = len(rows[0])
            placeholders = ", ".join(["%s"] * col_count)
            
            insert_sql = f"INSERT INTO `{table}` VALUES ({placeholders})"
            
            # Insertar en lotes de 100
            batch_size = 100
            for i in range(0, len(rows), batch_size):
                batch = rows[i:i+batch_size]
                dst_cursor.executemany(insert_sql, batch)
            
            dst.commit()
            print(f"   ✅ {table}: {len(rows)} registros")
        except Exception as e:
            print(f"   ❌ {table}: {e}")
            dst.rollback()
    
    # Reactivar FK checks
    dst_cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
    dst.commit()
    
    print("\n🎉 ¡Migración completada!")
    print(f"\n📌 Ahora actualiza las variables en Vercel:")
    print(f"   DATABASE_HOST = {DEST['host']}")
    print(f"   DATABASE_PORT = {DEST['port']}")
    print(f"   DATABASE_USER = {DEST['user']}")
    print(f"   DATABASE_PASSWORD = {DEST['password']}")
    print(f"   DATABASE_NAME = {DEST['database']}")
    
    src.close()
    dst.close()

if __name__ == "__main__":
    migrate()
