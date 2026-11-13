INSERT INTO customers
(customer_code, full_name, phone_number, status)
VALUES
('CU-001', 'Chelsea Espadilla', '09175550101', 'Active'),
('CU-002', 'Trixie Nicole Similla', '09182223456', 'Active'),
('CU-003', 'Francis Ortega', '09228889101', 'Active'),
('CU-004', 'John Rayver Laurista', '09051114422', 'Inactive'),
('CU-005', 'Jan Rafael Eugenio', '09197773311', 'Active');

INSERT INTO products
(product_code, product_name, category, cost_price, selling_price, stock_quantity, status)
VALUES
('PRD-001','Refill 5 Gallon','Refill',15,25,120,'Active'),
('PRD-002','Container 5 Gallon','Container',120,150,85,'Active'),
('PRD-003','Bottled Water 500ml','Bottle',8,12,200,'Active'),
('PRD-004','Bottled Water 1L','Bottle',15,25,150,'Active'),
('PRD-005','Water Dispenser','Equipment',900,1200,20,'Active');

INSERT INTO delivery_vehicles
(vehicle_name, plate_number, driver_name)
VALUES
('Tricycle 1','ABC-1234','Francis Santos'),
('Tricycle 2','XYZ-5678','Kristian Cruz');

INSERT INTO quotations (
  quotation_no,
  customer_id,
  total_amount,
  valid_until,
  approval_status,
  created_by
)
SELECT
  'QT-001',
  id,
  2500,
  CURRENT_DATE + INTERVAL '30 days',
  'Pending',
  'Procurement Department'
FROM customers
WHERE customer_code='CU-001';

INSERT INTO sales_orders (
  order_no,
  customer_id,
  payment_status,
  delivery_status,
  total_amount
)
SELECT
  'SO-001',
  id,
  'Paid',
  'Delivered',
  2500
FROM customers
WHERE customer_code='CU-001';
