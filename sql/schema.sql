CREATE DATABASE IF NOT EXISTS aquamuna_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE aquamuna_db;

-- =====================================================
-- USERS
-- =====================================================

CREATE TABLE users (
    user_id INT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(150),
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('staff','admin','superadmin') NOT NULL,
    status ENUM('Active','Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- BRANCHES
-- =====================================================

CREATE TABLE branches (
    branch_id INT NOT NULL,
    branch_name VARCHAR(100) NOT NULL,
    status ENUM('Active','Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CUSTOMERS
-- =====================================================

CREATE TABLE customers (
    customer_id INT NOT NULL,
    customer_code VARCHAR(20) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    phone_number VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    branch_id INT NOT NULL,
    status ENUM('Active','Inactive') DEFAULT 'Active',
    inactive_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================
-- CUSTOMER CONTAINERS
-- =====================================================

CREATE TABLE customer_containers (
    container_id INT NOT NULL,
    customer_id INT NOT NULL,
    lent INT DEFAULT 0,
    returned INT DEFAULT 0,
    deposit_amount DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PRODUCTS
-- =====================================================

CREATE TABLE products (
    product_id INT NOT NULL,
    sku VARCHAR(30) NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    category ENUM(
        'Refills',
        'Containers',
        'Accessories',
        'Equipment'
    ) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    branch_id INT,
    status ENUM('Active','Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- QUOTATIONS
-- =====================================================

CREATE TABLE quotations (
    quotation_id INT NOT NULL,
    quotation_no VARCHAR(20) NOT NULL,
    customer_id INT NOT NULL,
    quotation_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    sent_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- QUOTATION ITEMS
-- =====================================================

CREATE TABLE quotation_items (
    quotation_item_id INT NOT NULL,
    quotation_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL
);

-- =====================================================
-- SALES ORDERS
-- =====================================================

CREATE TABLE sales_orders (
    order_id INT NOT NULL,
    order_no VARCHAR(20) NOT NULL,
    customer_id INT NOT NULL,
    quotation_id INT,
    total_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SALES ORDER ITEMS
-- =====================================================

CREATE TABLE sales_order_items (
    sales_order_item_id INT NOT NULL,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL
);

-- =====================================================
-- DELIVERIES / DISPATCH
-- =====================================================

CREATE TABLE deliveries (
    delivery_id INT NOT NULL,
    delivery_no VARCHAR(20) NOT NULL,
    order_id INT NOT NULL,
    driver_name VARCHAR(150) NOT NULL,
    vehicle VARCHAR(100),
    delivery_date DATE NOT NULL,
    delivery_time TIME NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================
-- DELIVERY INCIDENTS
-- =====================================================

CREATE TABLE delivery_incidents (
    incident_id INT NOT NULL,
    delivery_id INT NOT NULL,
    incident_type ENUM(
        'Rider Accident',
        'Vehicle Breakdown',
        'Shift Ended',
        'Customer Unavailable'
    ) NOT NULL,
    goods_condition ENUM(
        'Intact',
        'Damaged',
        'Lost'
    ) NOT NULL,
    old_driver VARCHAR(150),
    new_driver VARCHAR(150),
    old_schedule DATETIME,
    new_schedule DATETIME,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- DELIVERY RECEIPTS
-- =====================================================

CREATE TABLE delivery_receipts (
    delivery_receipt_id INT NOT NULL,
    delivery_id INT NOT NULL,
    received_by VARCHAR(150) NOT NULL,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PAYMENTS
-- =====================================================

CREATE TABLE payments (
    payment_id INT NOT NULL,
    payment_no VARCHAR(20) NOT NULL,
    customer_id INT NOT NULL,
    order_id INT NOT NULL,
    payment_method ENUM(
        'Cash',
        'GCash'
    ) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- OFFICIAL RECEIPTS
-- =====================================================

CREATE TABLE official_receipts (
    official_receipt_id INT NOT NULL,
    receipt_no VARCHAR(20) NOT NULL,
    payment_id INT NOT NULL,
    issued_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    email_sent BOOLEAN DEFAULT FALSE,
    sent_at DATETIME NULL
);

-- =====================================================
-- RETURNS
-- =====================================================

CREATE TABLE returns (
    return_id INT NOT NULL,
    return_no VARCHAR(20) NOT NULL,
    order_id INT NOT NULL,
    quantity INT NOT NULL,
    reason TEXT,
    refund_amount DECIMAL(10,2),
    status ENUM(
        'Pending',
        'Processed'
    ) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ACTIVITY LOGS
-- =====================================================

CREATE TABLE activity_logs (
    log_id INT NOT NULL,
    user_id INT,
    module_name VARCHAR(100) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    record_type VARCHAR(100),
    record_id VARCHAR(100),
    old_values JSON,
    new_values JSON,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);