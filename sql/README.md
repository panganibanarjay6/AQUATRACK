# AQUATRACK Database Setup

## Database Files

| File | Description |
|--------|-------------|
| schema.sql | Creates extensions, tables, constraints, relationships, profiles, and views |
| indexes.sql | Creates performance indexes |
| sample_data.sql | Inserts sample data for testing and development |

## Execution Order

Run the SQL files in the following order:

### 1. Create Database Structure

```sql
schema.sql
```

Creates:

- PostgreSQL extensions
- Tables
- Primary keys
- Foreign keys
- Constraints
- Views

### 2. Create Indexes

```sql
indexes.sql
```

Creates indexes to improve query performance.

### 3. Insert Sample Data

```sql
seed.sql
```

Populates the database with sample customers, products, vehicles, quotations, and sales orders.

## Setup Example

```sql
-- Step 1
\i schema.sql

-- Step 2
\i indexes.sql

-- Step 3
\i seed.sql
```

## Notes

- Execute `schema.sql` only once when creating a fresh database.
- Execute `indexes.sql` after all tables have been created.
- Execute `sample_data.sql` only for development, testing, or demonstration data.
- Do not run the DROP TABLE statements in production environments.