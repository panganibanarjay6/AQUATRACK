AQUAMUNA PROCUREMENT  -  XAMPP (PHP + MySQL) version
=====================================================

INSTALL (5 minutes)
1. Open the XAMPP Control Panel and Start  Apache  and  MySQL.
2. Copy the folder  aquamuna_procurement  into  C:\xampp\htdocs\
3. Open http://localhost/phpmyadmin  ->  Import tab  ->  choose  sql/schema.sql  ->  Go.
   (This creates the database "aquamuna_procurement" and the two login accounts.)
4. Open  http://localhost/aquamuna_procurement/

LOGINS (same as before)
   superadmin / super123   - full access
   admin      / admin123   - limited access
   To change a password: phpMyAdmin > aquamuna_procurement > users > edit
   (or ask for a small script that does it).

FIRST RUN
   The database starts empty. The first time you sign in, the app fills in the same
   starting data it always had (suppliers, materials, 25 branches, price list).

FILES
   index.php          the page (login screen + system)
   api.php            sign-in / sign-out / saving to MySQL
   includes/config.php  database host, user, password (XAMPP default: root, no password)
   includes/db.php      how the app's records map to the SQL tables
   sql/schema.sql       tables (suppliers, items, price_list, purchase_requests, rfqs,
                        quotations, purchase_orders, goods_receipts, invoices,
                        payment_requests, payment_receipts, branches, branch_stock,
                        distributions, messages, audit_log, users, app_meta)
   assets/              app.js, style.css, logo files, Lexend font

Data is no longer kept in the browser: every change is saved to MySQL, so all
computers that open the site see the same records.

If you see "Cannot reach the database": start MySQL in XAMPP and import sql/schema.sql.
If your MySQL root has a password, put it in includes/config.php.
