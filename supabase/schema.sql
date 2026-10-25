-- ============================================================================
-- AquaTrack ERP — Production module tables
-- Run this once in Supabase → SQL Editor → New query → paste → Run.
--
-- These tables belong to the Production module only. Other modules (Procurement,
-- Inventory, Sales, Finance/HR) keep their own tables and talk to us through the
-- production_events outbox.
--
-- The Node server talks to these tables with the anon key in config.json (or a
-- service_role key in .env). Row Level Security is left off, so the shared anon
-- key can read and write the demo data. Only put demo data in this database.
-- ============================================================================

create table if not exists public.production_products (
  id         text primary key,
  code       text not null unique,
  name       text not null,
  category   text,
  unit       text,
  price      numeric default 0,
  is_active  boolean default true
);

create table if not exists public.production_boms (
  id         text primary key,
  code       text not null unique,
  product_id text references public.production_products(id) on delete cascade,
  status     text default 'Active',
  items      jsonb not null default '[]'::jsonb
);

create table if not exists public.production_orders (
  id            text primary key,
  code          text not null unique,
  product_id    text references public.production_products(id),
  qty           numeric not null,
  status        text not null default 'material_pending',
  stage         text,
  progress_pct  int default 0,
  planned_start date,
  notes         text,
  created_at    timestamptz default now(),
  stages        jsonb not null default '[]'::jsonb,
  output        jsonb not null default '[]'::jsonb
);

create table if not exists public.production_plans (
  id         text primary key,
  plan_date  date not null,
  product_id text references public.production_products(id),
  qty        numeric not null,
  status     text default 'Scheduled'
);

create table if not exists public.production_material_requests (
  id         text primary key,
  code       text not null unique,
  order_id   text references public.production_orders(id) on delete cascade,
  qty_units  numeric not null,
  status     text default 'Pending',
  created_at timestamptz default now(),
  lines      jsonb not null default '[]'::jsonb
);

create table if not exists public.production_issuances (
  id            text primary key,
  code          text not null unique,
  date          date not null,
  order_id      text references public.production_orders(id),
  request_id    text references public.production_material_requests(id),
  material_name text,
  material_code text,
  qty           numeric,
  uom           text,
  issued_by     text,
  status        text default 'Issued'
);

create table if not exists public.production_machines (
  id        text primary key,
  line_name text,
  name      text,
  status    text,
  note      text
);

create table if not exists public.production_finished_goods (
  id          text primary key,
  code        text not null unique,
  order_id    text references public.production_orders(id),
  product_id  text references public.production_products(id),
  qty         numeric not null,
  record_date date not null,
  status      text default 'In Stock'
);

create table if not exists public.production_cost_rates (
  id              text primary key,
  product_id      text references public.production_products(id) on delete cascade,
  labor_per_unit  numeric default 0,
  machine_per_unit numeric default 0,
  effective_from  date
);

create table if not exists public.production_cost_summaries (
  id            text primary key,
  period_start  date,
  period_end    date,
  product_code  text,
  product_name  text,
  units         numeric,
  material_cost numeric,
  labor_cost    numeric,
  machine_cost  numeric,
  total_cost    numeric
);

create table if not exists public.production_cost_postings (
  id         text primary key,
  code       text unique,
  order_id   text references public.production_orders(id),
  units      numeric,
  unit_cost  numeric,
  total_cost numeric,
  status     text default 'Pending',
  created_at timestamptz default now()
);

-- "actor" because "user" is a reserved word in Postgres.
create table if not exists public.production_audit (
  id        text primary key,
  at        timestamptz default now(),
  actor     text,
  action    text,
  module    text,
  reference text
);

-- Outbox for the other modules (see INTEGRATION_CONTRACT.md).
create table if not exists public.production_events (
  id            text primary key,
  event_type    text,
  target_module text,
  payload       jsonb default '{}'::jsonb,
  source_module text default 'production',
  status        text default 'pending',
  created_at    timestamptz default now()
);

create index if not exists production_orders_status_idx        on public.production_orders (status);
create index if not exists production_issuances_date_idx       on public.production_issuances (date);
create index if not exists production_fg_date_idx              on public.production_finished_goods (record_date);
create index if not exists production_audit_at_idx             on public.production_audit (at desc);
create index if not exists production_events_target_idx        on public.production_events (target_module, status);

-- ---------------------------------------------------------------------------
-- Access for the shared (anon) key used by config.json.
--
-- Row Level Security is left OFF on these tables, so anyone holding the anon key
-- can read and write the demo data. That is what makes "clone and run" work for
-- the whole team. Only put demo data in this database.
--
-- If you later turn RLS on, the anon key stops working until you add policies.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on
  public.production_products,
  public.production_boms,
  public.production_orders,
  public.production_plans,
  public.production_material_requests,
  public.production_issuances,
  public.production_machines,
  public.production_finished_goods,
  public.production_cost_rates,
  public.production_cost_summaries,
  public.production_cost_postings,
  public.production_audit,
  public.production_events
to anon, authenticated, service_role;
