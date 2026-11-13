CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CUSTOMERS
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  phone_number VARCHAR(20),
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- CUSTOMER ADDRESSES
CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- CUSTOMER CONTAINERS
CREATE TABLE customer_containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  containers_lent INTEGER DEFAULT 0,
  containers_returned INTEGER DEFAULT 0,
  containers_unreturned INTEGER DEFAULT 0,
  deposit_amount DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- PRODUCTS
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code VARCHAR(30) UNIQUE NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  category VARCHAR(100),
  cost_price DECIMAL(12,2) DEFAULT 0,
  selling_price DECIMAL(12,2) DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- QUOTATIONS
CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_no VARCHAR(30) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  total_amount DECIMAL(12,2),
  valid_until DATE,
  approval_status VARCHAR(20) DEFAULT 'Pending',
  created_by VARCHAR(100),
  approved_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- SALES ORDERS
CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no VARCHAR(30) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  payment_status VARCHAR(30) DEFAULT 'Pending',
  delivery_status VARCHAR(30) DEFAULT 'Pending',
  total_amount DECIMAL(12,2),
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- SALES ORDER ITEMS
CREATE TABLE sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL
);

-- INVOICES
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no VARCHAR(30) UNIQUE NOT NULL,
  sales_order_id UUID REFERENCES sales_orders(id),
  customer_id UUID REFERENCES customers(id),
  amount DECIMAL(12,2),
  due_date DATE,
  branch VARCHAR(100),
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- PRODUCT RETURNS
CREATE TABLE product_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_no VARCHAR(30) UNIQUE NOT NULL,
  invoice_id UUID REFERENCES invoices(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER,
  reason TEXT,
  refund_amount DECIMAL(12,2),
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- DELIVERY VEHICLES
CREATE TABLE delivery_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_name VARCHAR(100),
  plate_number VARCHAR(30),
  driver_name VARCHAR(150),
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- DELIVERIES
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_no VARCHAR(30) UNIQUE NOT NULL,
  sales_order_id UUID REFERENCES sales_orders(id),
  vehicle_id UUID REFERENCES delivery_vehicles(id),
  customer_id UUID REFERENCES customers(id),
  delivery_date DATE,
  status VARCHAR(30) DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- DELIVERY RECEIPTS
CREATE TABLE delivery_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no VARCHAR(30) UNIQUE NOT NULL,
  delivery_id UUID REFERENCES deliveries(id),
  received_by VARCHAR(150),
  received_date DATE,
  status VARCHAR(20) DEFAULT 'Received',
  created_at TIMESTAMP DEFAULT NOW()
);

-- PAYMENTS
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_no VARCHAR(30) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  payment_method VARCHAR(50),
  amount DECIMAL(12,2),
  payment_date DATE,
  status VARCHAR(30) DEFAULT 'Paid',
  created_at TIMESTAMP DEFAULT NOW()
);

-- OFFICIAL RECEIPTS
CREATE TABLE official_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  or_no VARCHAR(30) UNIQUE NOT NULL,
  payment_id UUID REFERENCES payments(id),
  customer_id UUID REFERENCES customers(id),
  amount DECIMAL(12,2),
  receipt_date DATE,
  qr_code TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  scanned_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'Issued',
  created_at TIMESTAMP DEFAULT NOW()
);

-- AUDIT LOGS
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID,
  action VARCHAR(20) NOT NULL,
  old_data JSONB,
  new_data JSONB,
  performed_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- INVENTORY
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  sales_order_id UUID REFERENCES sales_orders(id),
  transaction_type VARCHAR(20),
  quantity INTEGER NOT NULL,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- PROFILES
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL CHECK (
    role IN ('Admin','Procurement','Sales','Delivery','Finance')
  ),
  created_at TIMESTAMP DEFAULT NOW()
);

-- VIEWS
CREATE OR REPLACE VIEW product_profit_view AS
SELECT
  product_code,
  product_name,
  category,
  cost_price,
  selling_price,
  (selling_price - cost_price) AS profit,
  ROUND(
    ((selling_price - cost_price) / NULLIF(cost_price,0)) * 100,
    2
  ) AS profit_percentage
FROM products;

