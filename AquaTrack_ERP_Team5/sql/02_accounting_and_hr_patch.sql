-- Run AFTER schema.sql and seed.sql. Adds the Accounting tables and patches the HR tables.
USE aquatrack_erp;

-- 1) Replace the old single-row journal_entries with a proper header + lines design.
--    (Old rows are dropped. Payroll rows are reset so they can be re-posted correctly.)
DROP TABLE IF EXISTS journal_lines;
DROP TABLE IF EXISTS journal_entries;
UPDATE payroll SET posted_to_accounting = 0;

CREATE TABLE accounts (
    account_id INT AUTO_INCREMENT PRIMARY KEY,
    account_code VARCHAR(10) NOT NULL UNIQUE,
    account_name VARCHAR(100) NOT NULL,
    account_type ENUM('Asset','Liability','Equity','Revenue','Expense') NOT NULL,
    is_active TINYINT(1) DEFAULT 1
);
CREATE TABLE journal_entries (
    journal_id INT AUTO_INCREMENT PRIMARY KEY,
    entry_date DATE NOT NULL,
    reference_type VARCHAR(30),  -- Payroll, Payable, Receivable, Collection, Production, Manual, ...
    reference_id INT,            -- payroll_id, payable_id, receivable_id, po_id, so_id, production_id, ...
    description VARCHAR(255),
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);
CREATE TABLE journal_lines (
    line_id INT AUTO_INCREMENT PRIMARY KEY,
    journal_id INT NOT NULL,
    account_id INT NOT NULL,
    debit DECIMAL(12,2) NOT NULL DEFAULT 0,
    credit DECIMAL(12,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (journal_id) REFERENCES journal_entries(journal_id),
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);
-- supplier_id / customer_id / po_id / so_id are plain INT for now: add the FOREIGN KEY once
-- Procurement (suppliers, purchase_orders) and Sales (customers, sales_orders) finalize their tables.
CREATE TABLE payables (
    payable_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NULL, supplier_name VARCHAR(100) NOT NULL, po_id INT NULL,
    invoice_no VARCHAR(50) NOT NULL, invoice_date DATE NOT NULL, due_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL, status ENUM('Unpaid','Paid') DEFAULT 'Unpaid',
    paid_date DATE NULL, journal_id INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (journal_id) REFERENCES journal_entries(journal_id)
);
CREATE TABLE receivables (
    receivable_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NULL, customer_name VARCHAR(100) NOT NULL, so_id INT NULL,
    invoice_no VARCHAR(50) NOT NULL, invoice_date DATE NOT NULL, due_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL, amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('Unpaid','Partial','Paid') DEFAULT 'Unpaid', journal_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (journal_id) REFERENCES journal_entries(journal_id)
);
CREATE TABLE collections (
    collection_id INT AUTO_INCREMENT PRIMARY KEY,
    receivable_id INT NOT NULL, collection_date DATE NOT NULL, amount DECIMAL(12,2) NOT NULL,
    payment_method ENUM('Cash','GCash','Bank transfer') NOT NULL, journal_id INT NULL,
    FOREIGN KEY (receivable_id) REFERENCES receivables(receivable_id),
    FOREIGN KEY (journal_id) REFERENCES journal_entries(journal_id)
);

-- 2) HR patches
ALTER TABLE users MODIFY role ENUM('Admin','HR Staff','Payroll Staff','Accountant','Employee') NOT NULL DEFAULT 'Employee';
ALTER TABLE payroll ADD COLUMN journal_id INT NULL, ADD FOREIGN KEY (journal_id) REFERENCES journal_entries(journal_id);
ALTER TABLE payroll ADD UNIQUE KEY unique_payroll_period (employee_id, period_start, period_end); -- stops duplicate payroll runs
ALTER TABLE thirteenth_month_pay CHANGE id thirteenth_month_id INT AUTO_INCREMENT; -- naming convention: <table>_id
ALTER TABLE thirteenth_month_pay ADD COLUMN posted_to_accounting TINYINT(1) DEFAULT 0, ADD COLUMN journal_id INT NULL,
    ADD FOREIGN KEY (journal_id) REFERENCES journal_entries(journal_id);

-- 3) Chart of Accounts
INSERT INTO accounts (account_code, account_name, account_type) VALUES
('1000','Cash on Hand','Asset'),('1010','Cash in Bank','Asset'),('1100','Accounts Receivable','Asset'),
('1200','Inventory','Asset'),('2000','Accounts Payable','Liability'),('2100','Payroll & Contributions Payable','Liability'),
('3000','Owner''s Capital','Equity'),('4000','Sales Revenue','Revenue'),('5000','Cost of Goods Sold','Expense'),
('5100','Salaries Expense','Expense'),('5200','Utilities Expense','Expense'),('5300','Fuel & Delivery Expense','Expense'),
('5400','Supplies & Maintenance','Expense'),('5500','13th Month Pay Expense','Expense');
