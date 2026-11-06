AquaTrack ERP - Team 5 (Finance & HR)  | PHP + MySQL

SETUP (XAMPP)
1. Copy this folder to htdocs. Edit config/db.php (host/user/password, ERP_API_KEY).
2. In phpMyAdmin import, in order:  sql/00_schema.sql -> sql/01_seed.sql -> sql/02_accounting_and_hr_patch.sql
3. Open setup_admin.php once (creates admin / admin123), then DELETE it. Open login.php.
4. Admin > Users: create 'Accountant', 'HR Staff', 'Payroll Staff' users.

NOTES
- 02 patch DROPS the old journal_entries table (single-row design) and recreates it as header + journal_lines.
- Payroll no longer auto-posts. Use "Post to Accounting" (payroll.php, thirteenth_month.php).
- Other teams call api/erp.php (see comments inside) with header X-API-KEY.
- After the 3 imports, also run sql/03_rename_branches.sql and sql/04_official_contributions_2026.sql (official 2026 SSS / PhilHealth / Pag-IBIG).
- Then run sql/05_branch_scope.sql (branch-based accounting, required by the new UI).
