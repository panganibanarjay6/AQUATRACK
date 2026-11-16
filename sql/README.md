# AquaMuna Sales & CRM

AquaMuna Sales & CRM is a database-backed sales and customer
relationship management system for managing customers, products,
quotations, sales orders, deliveries, payments, returns, and related
activities.

## Database Information

-   **Database name:** `aquamuna_salesandcrm_schema`
-   **Database server:** MariaDB / MySQL through XAMPP
-   **Database management tool:** phpMyAdmin
-   **Backup format:** `.sql`

## Requirements

-   Windows
-   XAMPP
-   Apache and MySQL/MariaDB services
-   Web browser
-   phpMyAdmin

## Setup

1.  Install and open XAMPP.
2.  Start **Apache** and **MySQL**.
3.  Open phpMyAdmin at `http://localhost/phpmyadmin`.
4.  Create a database named `aquamuna_salesandcrm_schema` if it does not
    already exist.
5.  Select the database, open **Import**, and import the project's SQL
    schema or backup file.
6.  If the database already contains records, export a backup before
    importing additional SQL scripts.

> **Important:** Do not import the same sample-data script repeatedly
> unless it is designed to be re-run safely. Repeated INSERT statements
> can create duplicate records or primary-key errors.

## Database Tables

  -----------------------------------------------------------------------
  Table                               Purpose
  ----------------------------------- -----------------------------------
  `users`                             System user accounts and roles

  `branches`                          Branch records

  `customers`                         Customer information

  `customer_containers`               Customer container lending,
                                      returns, and deposits

  `products`                          Product details, prices, stock, and
                                      status

  `quotations`                        Customer quotations

  `quotation_items`                   Products and quantities included in
                                      quotations

  `sales_orders`                      Confirmed sales orders

  `sales_order_items`                 Products and quantities included in
                                      sales orders

  `deliveries`                        Delivery scheduling and dispatch
                                      information

  `delivery_incidents`                Delivery problems and rescheduling
                                      details

  `delivery_receipts`                 Records of received deliveries

  `payments`                          Customer payment records

  `official_receipts`                 Official receipt records linked to
                                      payments

  `returns`                           Product return and refund records

  `activity_logs`                     Records of user actions in the
                                      system
  -----------------------------------------------------------------------

## Useful SQL Commands

Select the database:

``` sql
USE `aquamuna_salesandcrm_schema`;
```

List all tables:

``` sql
SHOW TABLES;
```

View records in a table:

``` sql
SELECT * FROM customers;
```

View a table's structure:

``` sql
DESCRIBE customers;
```

Count records:

``` sql
SELECT COUNT(*) AS total_customers FROM customers;
```

Replace `customers` with the table you want to inspect.

## Recommended Data Insertion Order

Because tables are connected through foreign keys, insert parent records
before dependent records. A typical order is:

1.  `users`
2.  `branches`
3.  `customers`
4.  `products`
5.  `customer_containers`
6.  `quotations`
7.  `quotation_items`
8.  `sales_orders`
9.  `sales_order_items`
10. `deliveries`
11. `delivery_incidents` and `delivery_receipts`
12. `payments`
13. `official_receipts`
14. `returns`
15. `activity_logs`

The exact order can vary depending on the foreign keys populated by a
particular INSERT statement. Check table definitions if an insert fails
with a foreign-key error.

## Backup / Export

To save a complete database backup:

1.  Open phpMyAdmin.
2.  Select `aquamuna_salesandcrm_schema`.
3.  Click **Export**.
4.  Choose **Quick** and **SQL**.
5.  Click **Export** / **Go** to download the `.sql` file.
6.  Store the backup somewhere separate from the XAMPP installation.

For a more configurable backup, choose **Custom** and ensure both table
structure and data are included.

## Restore / Import a Backup

1.  Open phpMyAdmin.
2.  Create or select the target database.
3.  Click **Import**.
4.  Choose the saved `.sql` backup file.
5.  Start the import and check phpMyAdmin for errors.

Importing a full backup into a database that already contains the same
tables and records may cause conflicts. Back up the current database
first.

## User Accounts and Security

The `users` table stores system accounts and roles, including `admin`,
`staff`, and `superadmin` where configured.

-   Store passwords as secure password hashes, not plain-text passwords.
-   Do not commit real passwords, password hashes, database credentials,
    or private customer information to a public repository.
-   Change sample/default passwords before using the system.
-   Restrict access to the database and backup files.

## Troubleshooting

### MySQL starts and then stops in XAMPP

Check the MySQL error log before changing files in
`C:\xampp\mysql\data`. Make a complete backup before attempting repairs.

### Foreign-key error #1452

This usually means a referenced parent record does not exist. For
example, a row in `sales_order_items` cannot reference an `order_id`
that is missing from `sales_orders`.

Check the parent records first:

``` sql
SELECT * FROM sales_orders;
```

Use the actual `order_id` values when inserting into
`sales_order_items`.

### Duplicate entry / primary-key error

The record may already have been inserted, or the INSERT statement may
be supplying an ID that is already in use. Check the table contents
before retrying. If an ID column is `AUTO_INCREMENT`, normally omit it
from the INSERT column list.

## Project Notes

-   Confirm actual column names using `DESCRIBE table_name;` before
    running INSERT statements.
-   Use the IDs stored in the database rather than assuming IDs always
    start at `1`.
-   Keep a fresh SQL export before making schema changes or bulk data
    imports.
-   This README covers database setup and workflow; it does not replace
    the application's source code or deployment instructions.
