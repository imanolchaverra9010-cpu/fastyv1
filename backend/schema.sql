CREATE DATABASE IF NOT EXISTS rapidito;
USE rapidito;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'business', 'courier', 'customer') NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Negocios
CREATE TABLE IF NOT EXISTS businesses (
    id VARCHAR(50) PRIMARY KEY,
    owner_id INT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    address VARCHAR(255),
    phone VARCHAR(20),
    rating DECIMAL(3,2) DEFAULT 0.0,
    emoji VARCHAR(10),
    image_url VARCHAR(255),
    delivery_fee INT DEFAULT 0,
    eta VARCHAR(20),
    status ENUM('active', 'inactive', 'pending') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Tabla de Pedidos
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY,
    user_id INT,
    business_id VARCHAR(50),
    customer_name VARCHAR(100) NOT NULL,
    total INT NOT NULL,
    status ENUM('pending_payment', 'pending', 'confirmed', 'preparing', 'shipped', 'in_transit', 'delivered', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (business_id) REFERENCES businesses(id)
);

-- Tabla de Detalles de Pedido (Items)
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50),
    name VARCHAR(100) NOT NULL,
    price INT NOT NULL,
    quantity INT NOT NULL,
    emoji VARCHAR(10),
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Insertar algunos negocios base
INSERT IGNORE INTO businesses (id, owner_id, name, description, category, address, phone, rating, emoji, delivery_fee, eta, status) VALUES 
('1', 2, 'Pizzería Napolitana', 'Auténtica pizza al horno de leña.', 'Pizza', 'Calle 10 #5-20', '3001234567', 4.8, '🍕', 3500, '25-35 min', 'active'),
('2', NULL, 'Burger House', 'Las mejores hamburguesas artesanales.', 'Hamburguesas', 'Av. Siempre Viva 123', '3009876543', 4.5, '🍔', 2000, '20-30 min', 'active'),
('3', NULL, 'Sushi Zen', 'Sushi fresco de la mejor calidad.', 'Sushi', 'Carrera 15 #93-22', '3104567890', 4.9, '🍣', 5000, '40-50 min', 'active');

-- Tabla de Domiciliarios (si no existe)
CREATE TABLE IF NOT EXISTS couriers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    vehicle VARCHAR(50),
    status ENUM('online', 'busy', 'offline') DEFAULT 'offline',
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    rating DECIMAL(3,2) DEFAULT 5.0,
    deliveries INT DEFAULT 0,
    earnings INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabla de Pedidos Extendida
ALTER TABLE orders 
ADD COLUMN courier_id INT,
ADD COLUMN payment_method ENUM('card', 'cash', 'wallet') DEFAULT 'card',
ADD COLUMN delivery_address VARCHAR(255),
ADD COLUMN customer_phone VARCHAR(20),
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8),
ADD COLUMN notes TEXT,
ADD COLUMN cancellation_reason TEXT,
ADD COLUMN estimated_delivery_time TIMESTAMP NULL,
ADD COLUMN order_type ENUM('regular', 'open') DEFAULT 'regular',
ADD COLUMN origin_name VARCHAR(100),
ADD COLUMN origin_address VARCHAR(255),
ADD COLUMN open_order_description TEXT,
ADD COLUMN batch_id VARCHAR(50),
ADD COLUMN delivery_fee INT NOT NULL DEFAULT 0,
ADD COLUMN night_fee INT NOT NULL DEFAULT 0,
ADD COLUMN is_rated BOOLEAN NOT NULL DEFAULT FALSE,
ADD CONSTRAINT fk_courier FOREIGN KEY (courier_id) REFERENCES couriers(id);

-- Tabla de Logs de Estados de Pedido
CREATE TABLE IF NOT EXISTS order_status_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50),
    status VARCHAR(50),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by INT, -- ID del usuario que hizo el cambio
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS used_coupons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    code VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_coupon (user_id, code),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50),
    business_id VARCHAR(50),
    courier_id INT,
    business_rating INT NOT NULL,
    courier_rating INT,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS order_rejections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    courier_id INT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order_rejections_order (order_id),
    INDEX idx_order_rejections_courier (courier_id)
);

CREATE TABLE IF NOT EXISTS order_courier_offers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    courier_id INT NOT NULL,
    user_id INT NOT NULL,
    amount INT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_order_courier_offer (order_id, courier_id),
    INDEX idx_order_courier_offers_order (order_id),
    INDEX idx_order_courier_offers_courier (courier_id),
    INDEX idx_order_courier_offers_user (user_id)
);

-- Tabla de Pagos
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    amount INT NOT NULL,
    currency VARCHAR(3) DEFAULT 'COP',
    status VARCHAR(20) NOT NULL,
    reference VARCHAR(100) UNIQUE NOT NULL,
    payment_method VARCHAR(50),
    wompi_transaction_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    INDEX idx_payments_order (order_id),
    INDEX idx_payments_reference (reference),
    INDEX idx_payments_wompi (wompi_transaction_id)
);

-- Insertar domiciliarios de prueba
INSERT IGNORE INTO couriers (id, user_id, name, vehicle, status, lat, lng) VALUES 
(1, 3, 'Carlos Perez', 'Moto', 'online', 4.6097, -74.0817),
(2, NULL, 'Ana Ruiz', 'Bicicleta', 'busy', 4.6110, -74.0820);

-- Insertar usuarios de prueba
INSERT IGNORE INTO users (id, username, email, password_hash, role) VALUES
(1, 'admin', 'admin@rapidito.com', '$2b$12$T20UJ9RYhQjthW9ya5uz2uXjJMRn3iAR4WcGynWaPGy9IOKDl63Pa', 'admin'),
(2, 'negocio1', 'negocio@rapidito.com', '$2b$12$T20UJ9RYhQjthW9ya5uz2uXjJMRn3iAR4WcGynWaPGy9IOKDl63Pa', 'business'),
(3, 'domi1', 'domi@rapidito.com', '$2b$12$T20UJ9RYhQjthW9ya5uz2uXjJMRn3iAR4WcGynWaPGy9IOKDl63Pa', 'courier');

-- Insertar algunos pedidos de prueba
INSERT IGNORE INTO orders (id, business_id, customer_name, total, status, payment_method, delivery_address, created_at) VALUES 
('ORD-001', '1', 'Juan Perez', 45000, 'delivered', 'card', 'Calle 10 #5-20', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
('ORD-002', '2', 'Ana Gomez', 28000, 'preparing', 'cash', 'Av. Siempre Viva 123', DATE_SUB(NOW(), INTERVAL 15 MINUTE)),
('ORD-003', '3', 'Carlos Ruiz', 65000, 'pending', 'card', 'Carrera 15 #93-22', NOW());

-- Insertar items para esos pedidos
INSERT IGNORE INTO order_items (order_id, name, price, quantity, emoji) VALUES 
('ORD-001', 'Pizza Pepperoni Large', 35000, 1, '🍕'),
('ORD-001', 'Coca-Cola 1.5L', 10000, 1, '🥤'),
('ORD-002', 'Bacon Cheeseburger', 18000, 1, '🍔'),
('ORD-002', 'Papas Fritas', 10000, 1, '🍟'),
('ORD-003', 'Sushi Platter 24pcs', 65000, 1, '🍣');

-- Insertar logs iniciales
INSERT IGNORE INTO order_status_logs (order_id, status, changed_at) VALUES 
('ORD-001', 'pending', DATE_SUB(NOW(), INTERVAL 130 MINUTE)),
('ORD-001', 'preparing', DATE_SUB(NOW(), INTERVAL 120 MINUTE)),
('ORD-001', 'shipped', DATE_SUB(NOW(), INTERVAL 100 MINUTE)),
('ORD-001', 'delivered', DATE_SUB(NOW(), INTERVAL 80 MINUTE)),
('ORD-002', 'pending', DATE_SUB(NOW(), INTERVAL 20 MINUTE)),
('ORD-002', 'preparing', DATE_SUB(NOW(), INTERVAL 15 MINUTE)),
('ORD-003', 'pending', NOW());

-- Tabla de Items de Menú
CREATE TABLE IF NOT EXISTS menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price INT NOT NULL,
    category VARCHAR(50),
    image_url VARCHAR(255),
    emoji VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Tabla de Promociones
CREATE TABLE IF NOT EXISTS promotions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_id VARCHAR(50) NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    discount_percent INT,
    promo_code VARCHAR(20),
    image_url VARCHAR(255),
    emoji VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
