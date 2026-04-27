"""
Crea la estructura de tablas de Fasty en TiDB Cloud.
Ejecutar una vez.
"""
import mysql.connector

TIDB = {
    "host": "gateway01.us-east-1.prod.aws.tidbcloud.com",
    "port": 4000,
    "user": "1gRTnVV5VRD9GSJ.root",
    "password": "gTt2g6czLahRYgqY",
    "database": "fasty",
    "ssl_disabled": False
}

TABLES = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        role ENUM('customer', 'business', 'courier', 'admin') DEFAULT 'customer',
        provider VARCHAR(50),
        provider_id VARCHAR(255),
        avatar_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS businesses (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        address VARCHAR(500),
        phone VARCHAR(20),
        emoji VARCHAR(10),
        image_url VARCHAR(500),
        delivery_fee INT DEFAULT 0,
        eta VARCHAR(50),
        status ENUM('active', 'inactive', 'pending') DEFAULT 'active',
        rating DECIMAL(3,2) DEFAULT 5.00,
        owner_id INT,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS menu_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        business_id VARCHAR(50),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        price INT NOT NULL,
        category VARCHAR(100),
        image_url VARCHAR(500),
        emoji VARCHAR(10),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS couriers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        vehicle VARCHAR(50),
        image_url VARCHAR(255),
        status ENUM('online', 'busy', 'offline') DEFAULT 'offline',
        lat DECIMAL(10,8),
        lng DECIMAL(11,8),
        rating DECIMAL(3,2) DEFAULT 5.00,
        deliveries INT DEFAULT 0,
        earnings INT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(50) PRIMARY KEY,
        business_id VARCHAR(50),
        user_id INT,
        courier_id INT,
        customer_name VARCHAR(200),
        customer_phone VARCHAR(20),
        delivery_address VARCHAR(500),
        payment_method VARCHAR(50),
        notes TEXT,
        total INT DEFAULT 0,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        status ENUM('pending', 'preparing', 'shipped', 'in_transit', 'delivered', 'cancelled') DEFAULT 'pending',
        order_type VARCHAR(20) DEFAULT 'regular',
        origin_name VARCHAR(200),
        origin_address VARCHAR(500),
        open_order_description TEXT,
        batch_id VARCHAR(50),
        cancellation_reason TEXT,
        is_rated BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(50),
        name VARCHAR(200),
        price INT DEFAULT 0,
        quantity INT DEFAULT 1,
        emoji VARCHAR(10),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS order_status_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(50),
        status VARCHAR(50),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS order_ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(50),
        business_id VARCHAR(50),
        courier_id INT,
        business_rating INT,
        courier_rating INT,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        subscription_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS business_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        business_name VARCHAR(200),
        description TEXT,
        category VARCHAR(100),
        address VARCHAR(500),
        phone VARCHAR(20),
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS promotions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        business_id VARCHAR(50),
        title VARCHAR(200),
        description TEXT,
        discount_percent INT,
        image_url VARCHAR(500),
        is_active BOOLEAN DEFAULT TRUE,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS cajas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        business_id VARCHAR(50),
        opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP NULL,
        initial_cash INT DEFAULT 0,
        final_cash INT,
        notes TEXT,
        status ENUM('open', 'closed') DEFAULT 'open',
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS gastos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        caja_id INT,
        description VARCHAR(500),
        amount INT DEFAULT 0,
        type VARCHAR(50) DEFAULT 'expense',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (caja_id) REFERENCES cajas(id) ON DELETE CASCADE
    )
    """
]

def create_tables():
    print("🔌 Conectando a TiDB Cloud...")
    conn = mysql.connector.connect(**TIDB)
    cursor = conn.cursor()
    
    print("🏗️  Creando tablas...\n")
    for i, sql in enumerate(TABLES):
        try:
            cursor.execute(sql)
            # Extraer nombre de la tabla del SQL
            name = sql.split("EXISTS")[1].split("(")[0].strip() if "EXISTS" in sql else f"tabla_{i}"
            print(f"   ✅ {name}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    conn.commit()
    conn.close()
    print("\n🎉 ¡Estructura creada en TiDB Cloud!")

if __name__ == "__main__":
    create_tables()
