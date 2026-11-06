-- AquaTrack Finance & HRIS - HR Module Full Schema
CREATE DATABASE IF NOT EXISTS aquatrack_erp;
USE aquatrack_erp;

-- Branches (25 branches across the company)
CREATE TABLE IF NOT EXISTS branches (
    branch_id INT AUTO_INCREMENT PRIMARY KEY,
    branch_name VARCHAR(100) NOT NULL,
    address VARCHAR(255)
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
    department_id INT AUTO_INCREMENT PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL
);

-- Employee Master
CREATE TABLE IF NOT EXISTS employees (
    employee_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    address VARCHAR(255),
    contact_number VARCHAR(20),
    email VARCHAR(100),
    department_id INT,
    branch_id INT NOT NULL,
    position VARCHAR(100),
    date_hired DATE NOT NULL,
    employment_status ENUM('Regular','Probationary','Resigned','Terminated') DEFAULT 'Probationary',
    basic_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
    sss_no VARCHAR(20),
    philhealth_no VARCHAR(20),
    pagibig_no VARCHAR(20),
    tin_no VARCHAR(20),
    photo_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived TINYINT(1) DEFAULT 0,
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
);

-- Users & Roles (login + permissions)
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Admin','HR Staff','Payroll Staff','Employee') NOT NULL DEFAULT 'Employee',
    employee_id INT NULL,
    branch_id INT NULL, -- NULL = not branch-locked (Admin/Payroll Staff); set for branch-scoped HR Staff
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
);

-- Attendance (with overtime hours)
CREATE TABLE IF NOT EXISTS attendance (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    time_in TIME,
    time_out TIME,
    overtime_hours DECIMAL(4,2) DEFAULT 0,
    status ENUM('Present','Late','Absent','Half-Day') DEFAULT 'Present',
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    UNIQUE KEY unique_employee_date (employee_id, attendance_date)
);

-- Leave balances
CREATE TABLE IF NOT EXISTS leave_balances (
    employee_id INT NOT NULL,
    leave_type ENUM('Vacation','Sick','Emergency') NOT NULL,
    credits_remaining DECIMAL(4,1) NOT NULL DEFAULT 5,
    PRIMARY KEY (employee_id, leave_type),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

-- Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
    leave_id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    leave_type ENUM('Vacation','Sick','Emergency') NOT NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    reason VARCHAR(255),
    status ENUM('Pending','Approved','Rejected') DEFAULT 'Pending',
    filed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

-- Government contribution brackets
CREATE TABLE IF NOT EXISTS government_contributions (
    bracket_id INT AUTO_INCREMENT PRIMARY KEY,
    salary_min DECIMAL(10,2) NOT NULL,
    salary_max DECIMAL(10,2) NOT NULL,
    sss_amount DECIMAL(8,2) NOT NULL,
    philhealth_amount DECIMAL(8,2) NOT NULL,
    pagibig_amount DECIMAL(8,2) NOT NULL
);

-- Payroll records (per employee per cutoff period)
CREATE TABLE IF NOT EXISTS payroll (
    payroll_id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    basic_salary DECIMAL(10,2) NOT NULL,
    overtime_pay DECIMAL(10,2) DEFAULT 0,
    absence_deduction DECIMAL(10,2) DEFAULT 0,
    late_deduction DECIMAL(10,2) DEFAULT 0,
    sss_deduction DECIMAL(8,2) DEFAULT 0,
    philhealth_deduction DECIMAL(8,2) DEFAULT 0,
    pagibig_deduction DECIMAL(8,2) DEFAULT 0,
    net_salary DECIMAL(10,2) NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    posted_to_accounting TINYINT(1) DEFAULT 0,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

-- 13th Month Pay
CREATE TABLE IF NOT EXISTS thirteenth_month_pay (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    year INT NOT NULL,
    total_basic_pay_earned DECIMAL(10,2) NOT NULL,
    thirteenth_month_amount DECIMAL(10,2) NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    UNIQUE KEY unique_employee_year (employee_id, year)
);

-- Audit Trail (logs every add/edit/delete across HR tables)
CREATE TABLE IF NOT EXISTS audit_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(50),
    table_name VARCHAR(50),
    record_id INT,
    details TEXT,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounting integration: journal entries table (Payroll module writes here after each run)
CREATE TABLE IF NOT EXISTS journal_entries (
    journal_id INT AUTO_INCREMENT PRIMARY KEY,
    entry_date DATE NOT NULL,
    reference_type VARCHAR(50), -- e.g. 'Payroll'
    reference_id INT,           -- e.g. payroll_id
    account_name VARCHAR(100),
    debit DECIMAL(10,2) DEFAULT 0,
    credit DECIMAL(10,2) DEFAULT 0,
    description VARCHAR(255)
);
