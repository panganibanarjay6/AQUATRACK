-- Removes duplicate branches (same name) and keeps the first one of each. Safe: employees, users and accounting records
-- are moved to the kept branch BEFORE the duplicates are deleted. Run once in phpMyAdmin > aquatrack_erp > SQL.
USE aquatrack_erp;
CREATE TEMPORARY TABLE branch_keep AS SELECT branch_name, MIN(branch_id) AS keep_id FROM branches GROUP BY branch_name;
UPDATE employees e       JOIN branches b ON b.branch_id = e.branch_id       JOIN branch_keep k ON k.branch_name = b.branch_name SET e.branch_id = k.keep_id;
UPDATE users u           JOIN branches b ON b.branch_id = u.branch_id       JOIN branch_keep k ON k.branch_name = b.branch_name SET u.branch_id = k.keep_id;
UPDATE journal_entries j JOIN branches b ON b.branch_id = j.branch_id       JOIN branch_keep k ON k.branch_name = b.branch_name SET j.branch_id = k.keep_id;
UPDATE payables p        JOIN branches b ON b.branch_id = p.branch_id       JOIN branch_keep k ON k.branch_name = b.branch_name SET p.branch_id = k.keep_id;
UPDATE receivables r     JOIN branches b ON b.branch_id = r.branch_id       JOIN branch_keep k ON k.branch_name = b.branch_name SET r.branch_id = k.keep_id;
DELETE b FROM branches b JOIN branch_keep k ON k.branch_name = b.branch_name WHERE b.branch_id <> k.keep_id;
-- Prevent it from happening again if the seed is imported twice:
ALTER TABLE branches ADD UNIQUE KEY unique_branch_name (branch_name);
SELECT COUNT(*) AS branches_left FROM branches;
