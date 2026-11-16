USE aquamuna_salesandcrm_schema;

--- =====================================================
-- USERS
--- =====================================================

INSERT INTO users (full_name, username, email, password_hash, role, status)
VALUES
('System Administrator','admin','admin@aquamuna.com','admin123','admin', 'Active'),
('System Staff', 'staff', 'staff@aquamuna.com', 'staff123', 'staff', 'Active'),
('System Superadmin', 'superadmin', 'superadmin@aquamuna.com', 'superadmin123', 'superadmin', 'Active');

--- =====================================================
-- BRANCHES
--- =====================================================

INSERT INTO branches (branch_name) VALUES
('Alaminos'),
('Bagong Pook'),
('Barangay I-A'),
('Barangay I-B'),
('Barangay II-A'),
('Barangay II-B'),
('Barangay III-A'),
('Barangay III-B'),
('Barangay IV-A'),
('Barangay IV-B'),
('Barangay V-A'),
('Barangay V-B'),
('Barangay VI-A'),
('Barangay VI-B'),
('Barangay VII-A'),
('Barangay VII-B'),
('Bautista'),
('Concepcion'),
('Del Remedio'),
('Dolores'),
('San Antonio'),
('San Buenaventura'),
('San Crispin'),
('San Francisco'),
('San Gabriel');

--- =====================================================
-- PRODUCTS
--- =====================================================
INSERT INTO products
(sku, product_name, category, price, stock_quantity, status)
VALUES
('PROD-001', 'Purified Water 5 Gallons', 'Refills', 25.00, 250, 'Active'),
('PROD-002', 'Mineral Water 5 Gallons', 'Refills', 30.00, 180, 'Active'),
('PROD-003', 'Empty Water Container', 'Containers', 200.00, 85, 'Active'),
('PROD-004', 'Bottle Cap', 'Accessories', 5.00, 500, 'Active'),
('PROD-005', 'Water Dispenser', 'Equipment', 1500.00, 12, 'Active'),
('PROD-006','Alkaline Water 5 Gallons', 'Refills', 35.00, 120, 'Active'),
('PROD-007', 'Bottle Seal', 'Accessories', 3.00, 800, 'Active');


--- =====================================================
-- CUSTOMERS
--- =====================================================
INSERT INTO customer (customer_code, full_name, email, phone_number, address, branch_id, status)
VALUES
('CU-001', 'Ana Reyes', 'ana.reyes@example.com', '09175550101', 'Barangay I-A, San Pablo City', 3, 'Active'),
('CU-002', 'Juan Dela Cruz', 'juan.delacruz@example.com', '09182223456', 'Bautista, San Pablo City', 17, 'Active'),
('CU-003', 'Maria Santos', 'maria.santos@example.com','09228889101', 'San Antonio, San Pablo City', 21, 'Active'),
('CU-004', 'Mark Cruz', 'mark.cruz@example.com', '09051114422', 'Concepcion, San Pablo City', 18, 'Inactive'),
('CU-005', 'Liza Fernandez', 'liza.fernandez@example.com', '09123456789', 'Del Remedio, San Pablo City', 19, 'Active'),
('CU-006', 'Carlo Macapagal', 'carlo.macapagal@example.com', '09273338844', 'Dolores, San Pablo City', 20, 'Active'),
('CU-007', 'Dan Gonzaga', 'dan.gonzaga@example.com', '09154446699', 'San Gabriel, San Pablo City', 25, 'Active'),
('CU-008', 'Leo Cruz', 'leo.cruz@example.com', '09985551234', 'Barangay V-A, San Pablo City', '11', 'Inactive'),
('CU-009', 'Anita Ledesma', 'anita.ledesma@example.com', '09179990088', 'Bagong Pook, San Pablo City', '2', 'Active'),
('CU-010', 'Katherine Tan', 'katherine.tan@example.com', '09178887766', 'Alaminos, Laguna', '1', 'Active');

-- =====================================================
-- CUSTOMER CONTAINERS
-- =====================================================

INSERT INTO customer_containers (customer_id, lent, returned, deposit_amount)
VALUES
(1, 20, 14, 1200.00),
(2, 14, 12, 400.00),
(3, 3, 1, 400.00),
(4, 30, 22, 1600.00),
(5, 3, 2, 200.00),
(6,13,7,1200.00),
(7, 3, 2, 200.00),
(8, 24, 6, 3600.00),
(9, 10, 6, 800.00),
(10, 16, 9, 1400.00);

-- =====================================================
-- PRODUCTS
-- =====================================================

INSERT INTO products (sku, product_name, category, price, stock_quantity, status)
VALUES
('PROD-001', 'Purified Water 5 Gallons', 'Refills', 25.00, 250, 'Active'),
('PROD-002', 'Mineral Water 5 Gallons', 'Refills', 30.00, 180, 'Active'),
('PROD-003', 'Empty Water Container', 'Containers', 200.00, 85, 'Active'),
('PROD-004', 'Bottle Cap', 'Accessories', 5.00, 500, 'Active'),
('PROD-005', 'Water Dispenser', 'Equipment', 1500.00, 12, 'Active'),
('PROD-006', 'Alkaline Water 5 Gallons', 'Refills', 35.00, 120, 'Active'),
('PROD-007', 'Bottle Seal', 'Accessories', 3.00, 800, 'Active');

-- =====================================================
-- SAMPLE QUOTATIONS
-- =====================================================

INSERT INTO quotations (quotation_no, customer_id, quotation_date, valid_until, total_amount)
VALUES
('QT-001', 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 1150.00),
('QT-002', 2, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 900.00);

-- =====================================================
-- QUOTATION ITEMS
-- =====================================================

INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price, subtotal)
VALUES
(1, 1, 30, 25.00, 750.00),
(1, 3, 2, 200.00, 400.00),
(2, 1, 20, 25.00, 500.00),
(2, 3, 2, 200.00, 400.00);

-- =====================================================
-- SAMPLE SALES ORDERS
-- =====================================================

INSERT INTO sales_orders (order_no, customer_id, quotation_id, total_amount)
VALUES
('SO-001', 1, 1, 1150.00),
('SO-002', 2, 2, 900.00);

-- =====================================================
-- SALES ORDER ITEMS
-- =====================================================

INSERT INTO sales_order_items (order_id, product_id, quantity, unit_price, subtotal)
VALUES
(1, 1, 30, 25.00, 750.00),
(1, 3, 2 , 200.00, 400.00),
(2, 1, 20, 25.00, 500.00),
(2, 3, 2, 200.00, 400.00),
(3, 1, 10, 25.00, 250.00),
(4, 1, 150, 25.00, 3750.00),
(4, 3, 5, 200.00, 1000.00),
(5, 1, 8, 25.00, 200.00),
(5, 3, 1, 200.00, 200.00);

-- =====================================================
-- SAMPLE DELIVERIES
-- =====================================================

INSERT INTO deliveries
(delivery_no, order_id, driver_name, vehicle, delivery_date, delivery_time)
VALUES
('DEL-001', 1, 'Francis', 'Tricycle', CURDATE(), '09:00:00'),
('DEL-002', 2, 'Kristian', 'E-Bike', CURDATE(), '10:30:00');

-- =====================================================
-- DELIVERY RECEIPTS
-- =====================================================

INSERT INTO delivery_receipts (delivery_id, received_by)
VALUES
(1, 'Maria Reyes');

-- =====================================================
-- PAYMENTS
-- =====================================================

INSERT INTO payments (payment_no, customer_id, order_id, payment_method, amount)
VALUES
('PAY-001', 1, 1, 'Cash', 1150.00);

-- =====================================================
-- OFFICIAL RECEIPTS
-- =====================================================

INSERT INTO official_receipts (receipt_no, payment_id, email_sent)
VALUES
('OR-1001', 1, 0);

-- =====================================================
-- RETURNS
-- =====================================================

INSERT INTO returns (return_no, order_id, quantity, reason, refund_amount, status)
VALUES
('RET-001', 1, 1, 'Leaking Container', 200.00, 'Processed');

-- =====================================================
-- ACTIVITY LOGS
-- =====================================================

INSERT INTO activity_logs (user_id, module_name, action_type, record_type, record_id, description)
VALUES
(1, 'Customer Management', 'CREATE', 'Customer', 'CU-001', 'Initial sample data'),
(1,'Sales Management', 'CREATE', 'Sales Order', 'SO-001', 'Initial sample data');