-- Aquamuna Procurement - database for Supabase (PostgreSQL)
-- PostgreSQL version for Supabase. Run in Supabase > SQL Editor.


CREATE TABLE IF NOT EXISTS users (
  id integer generated always as identity primary key,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL check (role in ('super','admin')),
  full_name text NOT NULL,
  active smallint NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS app_meta (
  k text PRIMARY KEY,
  v text NOT NULL
);

-- collection: suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id integer NOT NULL PRIMARY KEY,
  doc_no text NULL,
  created_on text NULL,
  name text NULL,
  contact text NULL,
  phone text NULL,
  email text NULL,
  address text NULL,
  status text NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);

-- collection: items
CREATE TABLE IF NOT EXISTS items (
  id integer NOT NULL PRIMARY KEY,
  doc_no text NULL,
  created_on text NULL,
  name text NULL,
  category text NULL,
  unit text NULL,
  stock numeric(14,2) NULL,
  reorder_level numeric(14,2) NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);

-- collection: pl
CREATE TABLE IF NOT EXISTS price_list (
  id integer NOT NULL PRIMARY KEY,
  doc_no text NULL,
  created_on text NULL,
  supplier_id integer NULL,
  item_id integer NULL,
  price numeric(14,2) NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);

-- collection: pr
CREATE TABLE IF NOT EXISTS purchase_requests (
  id integer NOT NULL PRIMARY KEY,
  doc_no text NULL,
  order_no text NULL,
  created_on text NULL,
  item_id integer NULL,
  qty numeric(14,2) NULL,
  dept text NULL,
  branch_id integer NULL,
  req_date text NULL,
  status text NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);

-- collection: rfq
CREATE TABLE IF NOT EXISTS rfqs (
  id integer NOT NULL PRIMARY KEY,
  doc_no text NULL,
  order_no text NULL,
  created_on text NULL,
  pr_id integer NULL,
  item_id integer NULL,
  qty numeric(14,2) NULL,
  supplier_id integer NULL,
  branch_id integer NULL,
  due_date text NULL,
  status text NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);

-- collection: quo
CREATE TABLE IF NOT EXISTS quotations (
  id integer NOT NULL PRIMARY KEY,
  doc_no text NULL,
  order_no text NULL,
  created_on text NULL,
  rfq_id integer NULL,
  supplier_id integer NULL,
  item_id integer NULL,
  qty numeric(14,2) NULL,
  price numeric(14,2) NULL,
  branch_id integer NULL,
  status text NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);

-- collection: po
CREATE TABLE IF NOT EXISTS purchase_orders (
  id integer NOT NULL PRIMARY KEY,
  doc_no text NULL,
  order_no text NULL,
  created_on text NULL,
  supplier_id integer NULL,
  item_id integer NULL,
  qty numeric(14,2) NULL,
  price numeric(14,2) NULL,
  branch_id integer NULL,
  order_date text NULL,
  status text NULL,
  quotation_id integer NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);

-- collection: gr
CREATE TABLE IF NOT EXISTS goods_receipts (
  id integer NOT NULL PRIMARY KEY,
  doc_no text NULL,
  order_no text NULL,
  created_on text NULL,
  po_id integer NULL,
  qty numeric(14,2) NULL,
  date_received text NULL,
  status text NULL,
  photo text NULL,
  photo_at text NULL,
  rider text NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);

-- collection: inv
CREATE TABLE IF NOT EXISTS invoices (
  id integer NOT NULL PRIMARY KEY,
  doc_no text NULL,
  order_no text NULL,
  created_on text NULL,
  po_id integer NULL,
  amount numeric(14,2) NULL,
  due_date text NULL,
  status text NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);

-- collection: pq
CREATE TABLE IF NOT EXISTS payment_requests (
  id integer NOT NULL PRIMARY KEY,
  doc_no text NULL,
  order_no text NULL,
  created_on text NULL,
  invoice_id integer NULL,
  amount numeric(14,2) NULL,
  req_date text NULL,
  status text NULL,
  reason text NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);

-- collection: rc
CREATE TABLE IF NOT EXISTS payment_receipts (
  id integer NOT NULL PRIMARY KEY,
  doc_no text NULL,
  order_no text NULL,
  created_on text NULL,
  payment_request_id integer NULL,
  invoice_id integer NULL,
  amount numeric(14,2) NULL,
  method text NULL,
  reference_no text NULL,
  date_paid text NULL,
  status text NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);

-- collection: branches
CREATE TABLE IF NOT EXISTS branches (
  id integer NOT NULL PRIMARY KEY,
  doc_no text NULL,
  created_on text NULL,
  name text NULL,
  status text NULL,
  is_warehouse smallint NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);

-- collection: bs
CREATE TABLE IF NOT EXISTS branch_stock (
  id integer NOT NULL PRIMARY KEY,
  doc_no text NULL,
  created_on text NULL,
  branch_id integer NULL,
  item_id integer NULL,
  stock numeric(14,2) NULL,
  reorder_level numeric(14,2) NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);

-- collection: dist
CREATE TABLE IF NOT EXISTS distributions (
  id integer NOT NULL PRIMARY KEY,
  doc_no text NULL,
  order_no text NULL,
  created_on text NULL,
  branch_id integer NULL,
  item_id integer NULL,
  qty numeric(14,2) NULL,
  pr_id integer NULL,
  date_issued text NULL,
  status text NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);

-- collection: msgs
CREATE TABLE IF NOT EXISTS messages (
  id integer NOT NULL PRIMARY KEY,
  po_id integer NULL,
  from_side text NULL,
  sender_name text NULL,
  sender_user text NULL,
  body text NULL,
  sent_at text NULL,
  is_read smallint NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);

-- collection: log
CREATE TABLE IF NOT EXISTS audit_log (
  id integer NOT NULL PRIMARY KEY,
  logged_at text NULL,
  action text NULL,
  record_type text NULL,
  doc_no text NULL,
  order_no text NULL,
  details text NULL,
  done_by text NULL,
  is_backfill smallint NULL,
  extra text NULL,
  h char(32) NULL,
  sort_pos integer NOT NULL DEFAULT 0
);


insert into users (username,password_hash,role,full_name) values
 ('superadmin','$2y$10$x5EW7cXDZ/Ju8Mhz0PvGMeBH2I3GCWxDaDomUoU.uJ.9BAH.o12YK','super','Super Admin'),
 ('admin','$2y$10$5DJNRA.T.JQT1OSRXjWgKuUygl8SGbgYOEvgEABSmnRXDNienyeYG','admin','Admin')
on conflict (username) do nothing;

-- Indexes (para mabilis ang paghahanap sa mga foreign-key-like columns)
create index if not exists idx_price_list_supplier_id on price_list (supplier_id);
create index if not exists idx_price_list_item_id on price_list (item_id);
create index if not exists idx_purchase_requests_branch_id on purchase_requests (branch_id);
create index if not exists idx_rfqs_pr_id on rfqs (pr_id);
create index if not exists idx_quotations_rfq_id on quotations (rfq_id);
create index if not exists idx_purchase_orders_supplier_id on purchase_orders (supplier_id);
create index if not exists idx_purchase_orders_branch_id on purchase_orders (branch_id);
create index if not exists idx_goods_receipts_po_id on goods_receipts (po_id);
create index if not exists idx_invoices_po_id on invoices (po_id);
create index if not exists idx_payment_requests_invoice_id on payment_requests (invoice_id);
create index if not exists idx_payment_receipts_invoice_id on payment_receipts (invoice_id);
create index if not exists idx_branch_stock_branch_id on branch_stock (branch_id);
create index if not exists idx_messages_po_id on messages (po_id);

-- Security: patayin ang public access (anon key) sa lahat ng tables.
-- Ang PHP ay kumokonekta bilang 'postgres' role kaya gagana pa rin; walang policy = walang ibang makakapasok.
alter table users enable row level security;
alter table app_meta enable row level security;
alter table suppliers enable row level security;
alter table items enable row level security;
alter table price_list enable row level security;
alter table purchase_requests enable row level security;
alter table rfqs enable row level security;
alter table quotations enable row level security;
alter table purchase_orders enable row level security;
alter table goods_receipts enable row level security;
alter table invoices enable row level security;
alter table payment_requests enable row level security;
alter table payment_receipts enable row level security;
alter table branches enable row level security;
alter table branch_stock enable row level security;
alter table distributions enable row level security;
alter table messages enable row level security;
alter table audit_log enable row level security;
