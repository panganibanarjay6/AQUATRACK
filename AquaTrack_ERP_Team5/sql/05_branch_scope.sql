-- Branch-based accounting (matches the final UI: Select Branch -> Finance & Accounting modules).
-- Run once in phpMyAdmin > aquatrack_erp > SQL. Existing test data is assigned to branch 1 (Alaminos (San Pablo)).
USE aquatrack_erp;
ALTER TABLE journal_entries ADD COLUMN branch_id INT NULL, ADD FOREIGN KEY (branch_id) REFERENCES branches(branch_id);
ALTER TABLE payables ADD COLUMN branch_id INT NULL, ADD FOREIGN KEY (branch_id) REFERENCES branches(branch_id);
ALTER TABLE receivables ADD COLUMN branch_id INT NULL, ADD FOREIGN KEY (branch_id) REFERENCES branches(branch_id);
UPDATE journal_entries SET branch_id = 1 WHERE branch_id IS NULL;
UPDATE payables SET branch_id = 1 WHERE branch_id IS NULL;
UPDATE receivables SET branch_id = 1 WHERE branch_id IS NULL;
