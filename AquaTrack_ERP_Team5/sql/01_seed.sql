-- Run this after schema.sql to seed lookup data

USE aquatrack_erp;

-- 25 branches (San Pablo area)
INSERT INTO branches (branch_name) VALUES
('Alaminos (San Pablo)'),
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

INSERT INTO departments (department_name) VALUES
('Production'), ('Sales & Cashiering'), ('Delivery'), ('Administration');

-- Example government contribution brackets - replace with your official SSS/PhilHealth/Pag-IBIG tables
INSERT INTO government_contributions (salary_min, salary_max, sss_amount, philhealth_amount, pagibig_amount) VALUES
(0,      10000,  180.00, 137.50, 100.00),
(10001,  15000,  292.50, 206.25, 100.00),
(15001,  20000,  405.00, 275.00, 100.00),
(20001,  25000,  517.50, 343.75, 100.00),
(25001,  99999999, 630.00, 412.50, 100.00);

-- NOTE: These figures are placeholders for testing only.
-- Replace with the current official SSS/PhilHealth/Pag-IBIG contribution tables
-- before using this for real payroll computation.
