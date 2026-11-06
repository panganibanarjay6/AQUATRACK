-- Official 2026 contribution rules (employee share). Run in phpMyAdmin > aquatrack_erp > SQL (safe to re-run).
-- SSS: 5% of Monthly Salary Credit (MSC 5,000 to 35,000, steps of 500)  -> bracket table below
-- PhilHealth: 5% premium split 50/50 = 2.5% employee, salary floor 10,000, ceiling 100,000 -> contribution_settings
-- Pag-IBIG: 2% employee, monthly fund salary capped at 10,000 (max 200) -> contribution_settings
-- Always verify against the latest SSS / PhilHealth / HDMF circulars.
USE aquatrack_erp;
CREATE TABLE IF NOT EXISTS contribution_settings (
    setting_key VARCHAR(40) PRIMARY KEY,
    setting_value DECIMAL(12,4) NOT NULL,
    description VARCHAR(150)
);
INSERT INTO contribution_settings (setting_key, setting_value, description) VALUES
('sss_rate', 5, 'SSS employee share, % of Monthly Salary Credit (display only; amounts come from the bracket table)'),
('philhealth_employee_rate', 2.5, 'PhilHealth employee share, % of monthly basic salary (5% premium split equally)'),
('philhealth_floor', 10000, 'PhilHealth minimum salary base'),
('philhealth_ceiling', 100000, 'PhilHealth maximum salary base'),
('pagibig_employee_rate', 2, 'Pag-IBIG employee share, % of monthly fund salary'),
('pagibig_max_fund_salary', 10000, 'Pag-IBIG maximum monthly fund salary (max employee share = 200)')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), description = VALUES(description);

DELETE FROM government_contributions;
INSERT INTO government_contributions (salary_min, salary_max, sss_amount, philhealth_amount, pagibig_amount) VALUES
(0.00,5249.99,250.00,0,0),
(5250.00,5749.99,275.00,0,0),
(5750.00,6249.99,300.00,0,0),
(6250.00,6749.99,325.00,0,0),
(6750.00,7249.99,350.00,0,0),
(7250.00,7749.99,375.00,0,0),
(7750.00,8249.99,400.00,0,0),
(8250.00,8749.99,425.00,0,0),
(8750.00,9249.99,450.00,0,0),
(9250.00,9749.99,475.00,0,0),
(9750.00,10249.99,500.00,0,0),
(10250.00,10749.99,525.00,0,0),
(10750.00,11249.99,550.00,0,0),
(11250.00,11749.99,575.00,0,0),
(11750.00,12249.99,600.00,0,0),
(12250.00,12749.99,625.00,0,0),
(12750.00,13249.99,650.00,0,0),
(13250.00,13749.99,675.00,0,0),
(13750.00,14249.99,700.00,0,0),
(14250.00,14749.99,725.00,0,0),
(14750.00,15249.99,750.00,0,0),
(15250.00,15749.99,775.00,0,0),
(15750.00,16249.99,800.00,0,0),
(16250.00,16749.99,825.00,0,0),
(16750.00,17249.99,850.00,0,0),
(17250.00,17749.99,875.00,0,0),
(17750.00,18249.99,900.00,0,0),
(18250.00,18749.99,925.00,0,0),
(18750.00,19249.99,950.00,0,0),
(19250.00,19749.99,975.00,0,0),
(19750.00,20249.99,1000.00,0,0),
(20250.00,20749.99,1025.00,0,0),
(20750.00,21249.99,1050.00,0,0),
(21250.00,21749.99,1075.00,0,0),
(21750.00,22249.99,1100.00,0,0),
(22250.00,22749.99,1125.00,0,0),
(22750.00,23249.99,1150.00,0,0),
(23250.00,23749.99,1175.00,0,0),
(23750.00,24249.99,1200.00,0,0),
(24250.00,24749.99,1225.00,0,0),
(24750.00,25249.99,1250.00,0,0),
(25250.00,25749.99,1275.00,0,0),
(25750.00,26249.99,1300.00,0,0),
(26250.00,26749.99,1325.00,0,0),
(26750.00,27249.99,1350.00,0,0),
(27250.00,27749.99,1375.00,0,0),
(27750.00,28249.99,1400.00,0,0),
(28250.00,28749.99,1425.00,0,0),
(28750.00,29249.99,1450.00,0,0),
(29250.00,29749.99,1475.00,0,0),
(29750.00,30249.99,1500.00,0,0),
(30250.00,30749.99,1525.00,0,0),
(30750.00,31249.99,1550.00,0,0),
(31250.00,31749.99,1575.00,0,0),
(31750.00,32249.99,1600.00,0,0),
(32250.00,32749.99,1625.00,0,0),
(32750.00,33249.99,1650.00,0,0),
(33250.00,33749.99,1675.00,0,0),
(33750.00,34249.99,1700.00,0,0),
(34250.00,34749.99,1725.00,0,0),
(34750.00,99999999.99,1750.00,0,0);
