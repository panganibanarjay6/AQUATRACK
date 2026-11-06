AQUAMUNA PROCUREMENT  -  PHP + Supabase (PostgreSQL) version
=============================================================

The app runs on XAMPP (Apache + PHP). The database is hosted on Supabase.
You do NOT need to start MySQL in XAMPP anymore.


WHAT YOU NEED
-------------
- XAMPP (Apache + PHP 8.x)
- A Supabase project (free plan is fine)
- Git


SETUP (about 15 minutes)
------------------------
1. Put the project inside C:\xampp\htdocs\
   Example: C:\xampp\htdocs\AQUATRACK\aquamuna_procurement\

2. Enable the PostgreSQL driver in PHP
   - Open C:\xampp\php\php.ini
   - Make sure these two lines have NO semicolon in front:
         extension=pdo_pgsql
         extension=pgsql
   - Save, then Stop and Start Apache in the XAMPP Control Panel.

3. Create the tables in Supabase
   - Supabase > SQL Editor > New query
   - Open sql/supabase_schema.sql, copy everything, paste, and press Run.
   - Table Editor should now show 18 tables (users, suppliers, purchase_orders, ...).

4. Create your config file
   - In the "includes" folder, copy config.example.php and name the copy config.php
   - In Supabase press the green "Connect" button > "Session pooler" > Type: PHP
   - Fill in DB_HOST, DB_USER and DB_PASS in config.php
     (use the Session pooler on port 5432, NOT the Transaction pooler)
   - config.php is listed in .gitignore. NEVER commit it or share it.

5. Start Apache in XAMPP and open:
       http://localhost/AQUATRACK/aquamuna_procurement/
   (adjust the folder names to match where you put the project)

6. Sign in with the default accounts "superadmin" and "admin".
   Ask the Procurement database integrator for the passwords, and change them
   in the users table before using real data.


FIRST RUN
---------
The database starts empty. The first time you sign in, the app fills in its
starting data (suppliers, materials, 25 branches, price list).


FILES
-----
   index.php             the page (login screen + system)
   api.php               sign-in / sign-out / saving to the database
   includes/db.php       connection + how the app's records map to the SQL tables
   includes/config.example.php   template. Copy it to config.php and fill it in
   sql/supabase_schema.sql       PostgreSQL tables for Supabase
   assets/               app.js, style.css, logos, Lexend font

Every change is saved to Supabase, so everyone using the same project sees the
same records.


TROUBLESHOOTING
---------------
"Cannot reach the database"
   Read the small text under the message. It shows the real error:
   - could not find driver            -> step 2 (pdo_pgsql not enabled; restart Apache)
   - password authentication failed   -> wrong DB_USER or DB_PASS in config.php
   - could not translate host name    -> wrong DB_HOST
   - timeout                          -> check your internet / use the Session pooler host

Page keeps loading and never opens
   Usually the database cannot be reached. Check config.php and your internet.

"Not Found"
   The folder name in the URL does not match the folder in htdocs.


NOTES FOR THE TEAM
------------------
- Do not commit passwords, config.php, or any file containing database credentials.
- The tables suppliers, items, branches, branch_stock, payment_requests,
  payment_receipts and audit_log may be shared with other teams. Ownership will
  be decided in the Database Integration meetings.
