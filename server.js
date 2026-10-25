'use strict';
/**
 * AquaTrack ERP — Production module backend.
 * Zero dependencies: Node's built-in http + fetch only.
 *
 * Storage:
 *   - If .env defines SUPABASE_URL + SUPABASE_SERVICE_KEY -> data lives in Supabase.
 *   - Otherwise it falls back to data.json, so the project still runs offline.
 *
 *   node server.js        -> http://localhost:4000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const seed = require('./seed');

const PORT = process.env.PORT || 4000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_FILE = path.join(__dirname, 'data.json');

/* ----------------------------------------------------------------- config */

/*
 * Settings are read from, in order of priority:
 *   1. real environment variables
 *   2. .env          (local only, git-ignored — may hold the service_role key)
 *   3. config.json   (committed — holds the project URL + anon key so anyone
 *                     who clones the repo is connected with no setup)
 */

let fileConfig = {};
try {
  fileConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch {
  /* no config.json — fine */
}

// Tiny .env reader (no dependency).
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* no .env — fine */
}

const cfg = (key) => process.env[key] || fileConfig[key] || '';

const SUPABASE_URL = String(cfg('SUPABASE_URL'))
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/rest\/v1$/, '');
const SERVICE_KEY = cfg('SUPABASE_SERVICE_KEY');
const ANON_KEY = cfg('SUPABASE_ANON_KEY');
const SUPABASE_KEY = SERVICE_KEY || ANON_KEY;
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);
const KEY_KIND = SERVICE_KEY ? 'service_role' : ANON_KEY ? 'anon' : 'none';

// key in `db`  ->  Supabase table
const TABLES = {
  products: 'production_products',
  boms: 'production_boms',
  orders: 'production_orders',
  plans: 'production_plans',
  material_requests: 'production_material_requests',
  issuances: 'production_issuances',
  machines: 'production_machines',
  finished_goods: 'production_finished_goods',
  cost_rates: 'production_cost_rates',
  cost_summaries: 'production_cost_summaries',
  cost_postings: 'production_cost_postings',
  audit: 'production_audit',
  events: 'production_events',
};

// Columns that cannot use the JS field name ("user" is reserved in Postgres).
const RENAME = { audit: { user: 'actor' } };

const toRow = (key, rec) => {
  const row = { ...rec };
  for (const [from, to] of Object.entries(RENAME[key] || {})) {
    if (from in row) {
      row[to] = row[from];
      delete row[from];
    }
  }
  return row;
};
const fromRow = (key, row) => {
  const rec = { ...row };
  for (const [from, to] of Object.entries(RENAME[key] || {})) {
    if (to in rec) {
      rec[from] = rec[to];
      delete rec[to];
    }
  }
  return rec;
};

/** One call to Supabase's REST API (PostgREST). */
async function sb(pathAndQuery, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase ${res.status} on ${pathAndQuery}: ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

let db;

async function init() {
  if (!USE_SUPABASE) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
      db = seed();
      await persist();
    }
    await upgradeLegacyStages();
    return;
  }

  db = {};
  for (const [key, table] of Object.entries(TABLES)) {
    const rows = await sb(`${table}?select=*`);
    db[key] = rows.map((r) => fromRow(key, r));
  }

  // First run on an empty database: upload the demo data.
  if (db.products.length === 0) {
    db = seed();
    await persist();
    console.log('Seeded the Supabase database with the demo data.');
  }

  await upgradeLegacyStages();
}

/**
 * Orders created before the 4-stage rename still carry the old names.
 * Rename them by position once so existing data matches the current process.
 */
async function upgradeLegacyStages() {
  const legacy = new Set(['Filtering', 'Labeling']);
  const stale = db.orders.filter((o) => Array.isArray(o.stages) && o.stages.some((s) => legacy.has(s.name)));
  if (!stale.length) return;
  for (const order of stale) {
    const current = order.stages.findIndex((s) => s.name === order.stage);
    order.stages = order.stages.map((s, i) => ({ ...s, name: STAGES[i] || s.name }));
    if (current >= 0) order.stage = STAGES[current] || order.stage;
  }
  try {
    await persist('orders');
    console.log(`Renamed process stages on ${stale.length} existing order(s).`);
  } catch (err) {
    // Never let a data fix stop the server from starting; it retries next boot.
    console.error('Could not save renamed stages (will retry next start):', err.message);
  }
}

/**
 * Write collections back to storage. With no Supabase configured this simply
 * rewrites data.json. Collections are small, so whole-collection upserts keep
 * the code easy to follow.
 */
async function persist(only) {
  if (!USE_SUPABASE) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return;
  }
  const keys = only ? (Array.isArray(only) ? only : [only]) : Object.keys(TABLES);
  for (const key of keys) {
    const rows = db[key] || [];
    const table = TABLES[key];
    if (key === 'cost_summaries') await sb(`${table}?id=not.is.null`, { method: 'DELETE' });
    if (!rows.length) continue;
    await sb(`${table}?on_conflict=id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.map((r) => toRow(key, r))),
    });
  }
}

/* ---------------------------------------------------------------- helpers */

const uid = () => crypto.randomUUID();
const nowISO = () => new Date().toISOString();
const todayISO = () => nowISO().slice(0, 10);
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const STAGES = ['Disinfection', 'Purifying', 'Bottling', 'Packaging'];

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function nextCode(prefix, rows, pad = 3) {
  let max = 0;
  for (const r of rows) {
    const m = /(\d+)$/.exec(r.code || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return prefix + String(max + 1).padStart(pad, '0');
}

const find = (list, id) => list.find((r) => r.id === id);
function need(list, id, label) {
  const row = find(list, id);
  if (!row) throw httpError(404, `${label} not found`);
  return row;
}
const productById = (id) => find(db.products, id);
const bomFor = (productId) => db.boms.find((b) => b.product_id === productId && b.status === 'Active');

function audit(action, reference, module = 'Production', user = 'C. Mendoza') {
  db.audit.unshift({ id: uid(), at: nowISO(), user, action, module, reference });
  if (db.audit.length > 200) db.audit.length = 200;
}
function emit(event_type, target_module, payload = {}) {
  db.events.unshift({
    id: uid(), event_type, target_module, payload,
    source_module: 'production', status: 'pending', created_at: nowISO(),
  });
}

/* ------------------------------------------------------ production logic */

function explodeBom(productId, units) {
  const bom = bomFor(productId);
  if (!bom) throw httpError(400, 'This product has no active BOM');
  return bom.items.map((it) => ({
    id: uid(),
    material_name: it.material_name,
    material_code: it.material_code,
    qty: round(it.qty_per_unit * units),
    uom: it.uom,
    issued_qty: 0,
  }));
}

async function createOrder({ product_id, qty, planned_start = null, notes = null }) {
  const product = productById(product_id);
  if (!product) throw httpError(400, 'Unknown product');
  qty = Number(qty);
  if (!(qty > 0)) throw httpError(400, 'Quantity must be greater than zero');
  if (!bomFor(product_id)) throw httpError(400, `${product.name} has no active BOM`);

  const order = {
    id: uid(),
    code: nextCode('PRO-', db.orders, 4),
    product_id,
    qty,
    status: 'material_pending',
    stage: null,
    progress_pct: 0,
    planned_start,
    notes,
    created_at: nowISO(),
    stages: STAGES.map((name) => ({ name, status: 'pending', started_at: null, completed_at: null })),
    output: [],
  };
  db.orders.push(order);
  audit(`Created production order ${order.code}`, order.code);
  await persist(['orders', 'audit']);
  return order;
}

async function generateMaterialRequest(orderId, qtyUnits) {
  const order = need(db.orders, orderId, 'Order');
  if (!['material_pending', 'ready'].includes(order.status)) {
    throw httpError(400, 'Order is past the material stage');
  }
  const units = Number(qtyUnits) > 0 ? Number(qtyUnits) : order.qty;
  const req = {
    id: uid(),
    code: nextCode('MR-', db.material_requests),
    order_id: order.id,
    qty_units: units,
    status: 'Pending',
    created_at: nowISO(),
    lines: explodeBom(order.product_id, units),
  };
  db.material_requests.push(req);
  audit(`Generated material request ${req.code} for ${order.code}`, req.code);
  emit('production.material_requested', 'inventory', { request: req.code, order: order.code });
  await persist(['material_requests', 'audit', 'events']);
  return req;
}

async function setRequestStatus(id, status) {
  const req = need(db.material_requests, id, 'Material request');
  req.status = status;
  audit(`${status} ${req.code}`, req.code);
  await persist(['material_requests', 'audit']);
  return req;
}

async function issueMaterials(requestId, lines) {
  const req = need(db.material_requests, requestId, 'Material request');
  if (req.status !== 'Approved') throw httpError(400, 'Approve the request before issuing');
  const order = need(db.orders, req.order_id, 'Order');
  const created = [];

  for (const line of req.lines) {
    const wanted = Array.isArray(lines) && lines.length
      ? Number(lines.find((l) => l.line_id === line.id)?.qty) || 0
      : line.qty - line.issued_qty;
    if (!(wanted > 0)) continue;
    const row = {
      id: uid(),
      code: nextCode('ISS-', db.issuances),
      date: todayISO(),
      order_id: order.id,
      request_id: req.id,
      material_name: line.material_name,
      material_code: line.material_code,
      qty: round(wanted),
      uom: line.uom,
      issued_by: 'C. Mendoza',
      status: 'Issued',
    };
    db.issuances.push(row);
    created.push(row);
    line.issued_qty = round(line.issued_qty + wanted);
    emit('production.material_issued', 'inventory', {
      issuance: row.code, order: order.code, material_name: line.material_name, qty: row.qty, uom: line.uom,
    });
  }

  if (!created.length) throw httpError(400, 'Nothing left to issue');
  if (req.lines.every((l) => l.issued_qty >= l.qty)) {
    req.status = 'Issued';
    if (order.status === 'material_pending') order.status = 'ready';
  }
  audit(`Issued materials for ${order.code}`, created.map((c) => c.code).join(', '));
  await persist(['issuances', 'material_requests', 'orders', 'audit', 'events']);
  return created;
}

function refreshProgress(order) {
  const done = order.stages.filter((s) => s.status === 'completed').length;
  order.progress_pct = Math.round((done / order.stages.length) * 100);
}

async function startOrder(orderId) {
  const order = need(db.orders, orderId, 'Order');
  if (order.status !== 'ready') throw httpError(400, 'Order is not ready (issue materials first)');
  order.status = 'in_progress';
  const first = order.stages[0];
  first.status = 'in_progress';
  first.started_at = nowISO();
  order.stage = first.name;
  audit(`Started ${order.code}`, order.code);
  await persist(['orders', 'audit']);
  return order;
}

async function advanceStage(orderId) {
  const order = need(db.orders, orderId, 'Order');
  if (order.status !== 'in_progress') throw httpError(400, 'Order is not in progress');
  const i = order.stages.findIndex((s) => s.status === 'in_progress');
  if (i === -1) throw httpError(400, 'No stage is in progress');
  order.stages[i].status = 'completed';
  order.stages[i].completed_at = nowISO();
  const next = order.stages[i + 1];
  if (next) {
    next.status = 'in_progress';
    next.started_at = nowISO();
    order.stage = next.name;
  }
  refreshProgress(order);
  audit(`Advanced ${order.code} to ${next ? next.name : 'last stage'}`, order.code);
  await persist(['orders', 'audit']);
  return order;
}

async function recordOutput(orderId, qtyGood, qtyRejected = 0) {
  const order = need(db.orders, orderId, 'Order');
  if (order.status !== 'in_progress') throw httpError(400, 'Order is not in progress');
  qtyGood = Number(qtyGood);
  if (!(qtyGood > 0)) throw httpError(400, 'Good quantity must be greater than zero');
  const log = { id: uid(), qty_good: qtyGood, qty_rejected: Number(qtyRejected) || 0, at: nowISO() };
  order.output.push(log);
  audit(`Recorded output for ${order.code} (${qtyGood} good)`, order.code);
  await persist(['orders', 'audit']);
  return log;
}

async function completeOrder(orderId) {
  const order = need(db.orders, orderId, 'Order');
  if (order.status !== 'in_progress') throw httpError(400, 'Only an in-progress order can be completed');
  order.stages.forEach((s) => {
    if (s.status !== 'completed') {
      s.status = 'completed';
      s.completed_at = nowISO();
    }
  });
  refreshProgress(order);
  order.status = 'completed';
  order.stage = 'Completed';

  const produced = order.output.reduce((sum, o) => sum + o.qty_good, 0) || order.qty;
  const fg = {
    id: uid(),
    code: nextCode('FG-', db.finished_goods),
    order_id: order.id,
    product_id: order.product_id,
    qty: produced,
    record_date: todayISO(),
    status: 'In Stock',
  };
  db.finished_goods.unshift(fg);

  const cost = unitCost(order.product_id);
  const posting = {
    id: uid(),
    code: nextCode('CP-', db.cost_postings),
    order_id: order.id,
    units: produced,
    unit_cost: cost.total_cost,
    total_cost: round(cost.total_cost * produced),
    status: 'Pending',
    created_at: nowISO(),
  };
  db.cost_postings.unshift(posting);

  audit(`Completed ${order.code} — ${produced} units`, order.code);
  emit('production.finished_goods_recorded', 'inventory', {
    finished_goods: fg.code, order: order.code, qty: produced, record_date: fg.record_date,
  });
  emit('production.order_completed', 'finance', {
    order: order.code, units: produced, unit_cost: cost.total_cost, total_cost: posting.total_cost,
  });
  await persist(['orders', 'finished_goods', 'cost_postings', 'audit', 'events']);
  return { order, finished_goods: fg, cost_posting: posting };
}

async function cancelOrder(orderId, reason) {
  const order = need(db.orders, orderId, 'Order');
  if (order.status === 'completed') throw httpError(400, 'Completed orders cannot be cancelled');
  if (order.status === 'cancelled') throw httpError(400, 'Order is already cancelled');
  const why = String(reason || '').trim();
  order.status = 'cancelled';
  order.stage = 'Cancelled';
  order.notes = why ? `Cancelled: ${why}` : 'Cancelled';
  audit(`Cancelled ${order.code}${why ? ` — ${why}` : ''}`, order.code);
  emit('production.order_cancelled', 'sales', { order: order.code, reason: why || null });
  await persist(['orders', 'audit', 'events']);
  return order;
}

/* ---------------------------------------------------------------- costing */

function unitCost(productId) {
  const bom = bomFor(productId);
  const material = bom ? bom.items.reduce((s, it) => s + it.qty_per_unit * it.std_unit_cost, 0) : 0;
  const rate = db.cost_rates.find((r) => r.product_id === productId) || { labor_per_unit: 0, machine_per_unit: 0 };
  return {
    product_id: productId,
    material_cost: round(material),
    labor_cost: round(rate.labor_per_unit),
    machine_cost: round(rate.machine_per_unit),
    total_cost: round(material + rate.labor_per_unit + rate.machine_per_unit),
  };
}

function standardCosting() {
  return db.products
    .filter((p) => p.is_active && bomFor(p.id))
    .map((p) => ({ product_code: p.code, product_name: p.name, ...unitCost(p.id) }));
}

function computeCostSummaries(start, end) {
  const inRange = (d) => d >= start && d <= end;
  return db.products
    .filter((p) => p.is_active)
    .map((product) => {
      const orders = db.orders.filter(
        (o) => o.product_id === product.id && o.status === 'completed' && inRange((o.created_at || '').slice(0, 10)),
      );
      const units = orders.reduce((s, o) => s + (o.output.reduce((a, l) => a + l.qty_good, 0) || o.qty), 0);
      const c = unitCost(product.id);
      return {
        product_code: product.code,
        product_name: product.name,
        units: round(units),
        material_cost: round(c.material_cost * units),
        labor_cost: round(c.labor_cost * units),
        machine_cost: round(c.machine_cost * units),
        total_cost: round(c.total_cost * units),
      };
    })
    .filter((row) => row.units > 0);
}

async function calculateCosting(start, end) {
  db.cost_summaries = computeCostSummaries(start, end).map((r) => ({
    id: uid(), period_start: start, period_end: end, ...r,
  }));
  audit(`Calculated production cost ${start} → ${end}`, `${start}..${end}`);
  await persist(['cost_summaries', 'audit']);
  return db.cost_summaries;
}

/* ---------------------------------------------------------------- reports */

function reportSummary(from, to) {
  const inRange = (d) => (!from || d >= from) && (!to || d <= to);
  const fg = db.finished_goods.filter((f) => inRange(f.record_date));
  const orders = db.orders.filter((o) => o.status === 'completed' && inRange((o.created_at || '').slice(0, 10)));
  const good = fg.reduce((s, f) => s + f.qty, 0);
  const rejected = db.orders.flatMap((o) => o.output).reduce((s, l) => s + l.qty_rejected, 0);
  return {
    orders_completed: orders.length,
    units_produced: round(good),
    units_rejected: round(rejected),
    yield_pct: good + rejected > 0 ? round((good / (good + rejected)) * 100, 1) : 0,
  };
}

function reportMaterialUsage(from, to) {
  const map = new Map();
  for (const row of db.issuances) {
    if (from && row.date < from) continue;
    if (to && row.date > to) continue;
    const cur = map.get(row.material_name) || {
      material_name: row.material_name, material_code: row.material_code, uom: row.uom, qty_issued: 0, entries: 0,
    };
    cur.qty_issued = round(cur.qty_issued + row.qty);
    cur.entries += 1;
    map.set(row.material_name, cur);
  }
  return [...map.values()];
}

function reportFinishedGoods(from, to) {
  return db.finished_goods
    .filter((f) => (!from || f.record_date >= from) && (!to || f.record_date <= to))
    .map((f) => ({
      code: f.code,
      product_name: (productById(f.product_id) || {}).name || 'Unknown',
      qty: f.qty,
      record_date: f.record_date,
      status: f.status,
    }));
}

function dashboard() {
  const active = db.orders.filter((o) => ['material_pending', 'ready', 'in_progress'].includes(o.status));
  const today = todayISO();
  const unitsToday = db.finished_goods.filter((f) => f.record_date === today).reduce((s, f) => s + f.qty, 0);
  const good = db.finished_goods.reduce((s, f) => s + f.qty, 0);
  const rejected = db.orders.flatMap((o) => o.output).reduce((s, l) => s + l.qty_rejected, 0);
  return {
    active_orders: active.length,
    units_today: unitsToday,
    yield_pct: good + rejected > 0 ? round((good / (good + rejected)) * 100, 1) : 0,
    unit_cost: unitCost('p1').total_cost,
    machines_online: db.machines.filter((m) => m.status === 'Online').length,
    machines_total: db.machines.length,
  };
}

/* ------------------------------------------------------------- bootstrap */

function bootstrap() {
  const productName = (id) => (productById(id) || {}).name || '';
  const orderOf = (id) => find(db.orders, id) || {};
  return {
    dashboard: dashboard(),
    products: db.products,
    boms: db.boms.map((b) => ({ ...b, product_name: productName(b.product_id) })),
    orders: db.orders.map((o) => ({ ...o, product_name: productName(o.product_id) })),
    plans: db.plans.map((p) => ({ ...p, product_name: productName(p.product_id) })),
    material_requests: db.material_requests.map((r) => ({
      ...r,
      order_code: orderOf(r.order_id).code || '',
      product_name: productName(orderOf(r.order_id).product_id),
      created_on: (r.created_at || '').slice(0, 10),
    })),
    issuances: db.issuances.map((i) => ({ ...i, order_code: orderOf(i.order_id).code || '' })),
    machines: db.machines,
    finished_goods: db.finished_goods.map((f) => ({ ...f, product_name: productName(f.product_id) })),
    costing: standardCosting(),
    audit: db.audit.filter((a) => a.module === 'Production'),
    events: db.events,
  };
}

/* ----------------------------------------------------------------- routes */
/* handler(params, query, body) — params is the :id map, body the JSON body. */

const routes = [];
function route(method, pattern, handler) {
  const names = [];
  const regex = new RegExp(
    '^' +
      pattern.replace(/:[A-Za-z_]+/g, (m) => {
        names.push(m.slice(1));
        return '([^/]+)';
      }) +
      '$',
  );
  routes.push({ method, regex, names, handler });
}

route('GET', '/api/bootstrap', () => bootstrap());
route('GET', '/api/dashboard', () => dashboard());

/* 1. Product master */
route('GET', '/api/products', () => db.products);
route('POST', '/api/products', async (_p, _q, body) => {
  if (!body.name) throw httpError(400, 'Product name is required');
  const row = {
    id: uid(),
    code: nextCode('PRD-', db.products),
    name: body.name,
    category: body.category || 'Drinking Water',
    unit: body.unit || '',
    price: Number(body.price) || 0,
    is_active: true,
  };
  db.products.push(row);
  audit(`Added product ${row.code} — ${row.name}`, row.code);
  await persist(['products', 'audit']);
  return row;
});
route('PATCH', '/api/products/:id', async ({ id }, _q, body) => {
  const row = need(db.products, id, 'Product');
  Object.assign(row, body);
  audit(`Updated product ${row.code}`, row.code);
  await persist(['products', 'audit']);
  return row;
});

/* 2. Bill of materials */
route('GET', '/api/boms', () => db.boms);
route('POST', '/api/boms', async (_p, _q, body) => {
  const product = productById(body.product_id);
  if (!product) throw httpError(400, 'Unknown product');
  const items = (body.items || []).map((it) => ({
    id: uid(),
    material_name: it.material_name,
    material_code: (it.material_code || it.material_name).toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 12),
    qty_per_unit: Number(it.qty_per_unit) || 0,
    uom: it.uom || 'unit',
    std_unit_cost: Number(it.std_unit_cost) || 0,
  }));
  const row = { id: uid(), code: nextCode('BOM-', db.boms), product_id: body.product_id, status: 'Active', items };
  db.boms.push(row);
  audit(`Created ${row.code} for ${product.name}`, row.code);
  await persist(['boms', 'audit']);
  return row;
});

/* 3. Production orders */
route('GET', '/api/orders', () => db.orders);
route('POST', '/api/orders', (_p, _q, body) => createOrder(body));
route('GET', '/api/orders/:id/timeline', ({ id }) => {
  const order = need(db.orders, id, 'Order');
  return order.stages.map((s, i) => ({
    seq: i + 1, stage: s.name, status: s.status, started_at: s.started_at, completed_at: s.completed_at,
  }));
});
route('POST', '/api/orders/:id/start', ({ id }) => startOrder(id));
route('POST', '/api/orders/:id/advance', ({ id }) => advanceStage(id));
route('POST', '/api/orders/:id/output', ({ id }, _q, body) => recordOutput(id, body.qty_good, body.qty_rejected));
route('POST', '/api/orders/:id/complete', ({ id }) => completeOrder(id));
route('POST', '/api/orders/:id/cancel', ({ id }, _q, body) => cancelOrder(id, body.reason));
route('POST', '/api/orders/:id/material-request', ({ id }, _q, body) => generateMaterialRequest(id, body.qty_units));

/* 4. Production planning */
route('GET', '/api/plans', () => db.plans);
route('POST', '/api/plans', async (_p, _q, body) => {
  if (!productById(body.product_id)) throw httpError(400, 'Unknown product');
  const row = {
    id: uid(),
    plan_date: body.plan_date || todayISO(),
    product_id: body.product_id,
    qty: Number(body.qty) || 0,
    status: body.status || 'Scheduled',
  };
  db.plans.push(row);
  audit(`Planned production for ${row.plan_date}`, row.plan_date);
  await persist(['plans', 'audit']);
  return row;
});
route('POST', '/api/plans/:id/convert', async ({ id }) => {
  const plan = need(db.plans, id, 'Plan');
  const order = await createOrder({ product_id: plan.product_id, qty: plan.qty, planned_start: plan.plan_date });
  plan.status = 'Converted';
  await persist(['plans']);
  return order;
});

/* 5. Material requirements */
route('GET', '/api/material-requests', () => db.material_requests);
route('POST', '/api/material-requests', (_p, _q, body) => generateMaterialRequest(body.order_id, body.qty_units));
route('POST', '/api/material-requests/:id/approve', ({ id }) => setRequestStatus(id, 'Approved'));
route('POST', '/api/material-requests/:id/reject', ({ id }) => setRequestStatus(id, 'Rejected'));

/* 6. Material issuance */
route('GET', '/api/issuances', () => db.issuances);
route('POST', '/api/issuances', (_p, _q, body) => issueMaterials(body.request_id, body.lines));

/* 7. Monitoring */
route('GET', '/api/machines', () => db.machines);
route('PATCH', '/api/machines/:id', async ({ id }, _q, body) => {
  const row = need(db.machines, id, 'Machine');
  Object.assign(row, body);
  audit(`Machine ${row.name} set to ${row.status}`, row.line_name);
  await persist(['machines', 'audit']);
  return row;
});

/* 8. Finished goods */
route('GET', '/api/finished-goods', () => db.finished_goods);
route('POST', '/api/finished-goods', async (_p, _q, body) => {
  const order = need(db.orders, body.order_id, 'Order');
  const qty = Number(body.qty);
  if (!(qty > 0)) throw httpError(400, 'Quantity must be greater than zero');
  const row = {
    id: uid(),
    code: nextCode('FG-', db.finished_goods),
    order_id: order.id,
    product_id: order.product_id,
    qty,
    record_date: body.record_date || todayISO(),
    status: 'In Stock',
  };
  db.finished_goods.unshift(row);
  audit(`Recorded ${qty} finished goods for ${order.code}`, row.code);
  emit('production.finished_goods_recorded', 'inventory', { finished_goods: row.code, order: order.code, qty });
  await persist(['finished_goods', 'audit', 'events']);
  return row;
});

/* 9. Costing */
route('GET', '/api/costing/standard', () => standardCosting());
route('POST', '/api/costing/calculate', (_p, _q, body) =>
  calculateCosting(body.start || '0000-01-01', body.end || '9999-12-31'));

/* 10. Reports */
route('GET', '/api/reports/summary', (_p, q) => reportSummary(q.from, q.to));
route('GET', '/api/reports/material-usage', (_p, q) => reportMaterialUsage(q.from, q.to));
route('GET', '/api/reports/cost', (_p, q) => computeCostSummaries(q.from || '0000-01-01', q.to || '9999-12-31'));
route('GET', '/api/reports/finished-goods', (_p, q) => reportFinishedGoods(q.from, q.to));

/* cross-module inbox + audit trail */
route('GET', '/api/events', () => db.events);
route('GET', '/api/audit', () => db.audit);

/* ----------------------------------------------------------------- server */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const payload = type.startsWith('application/json') ? JSON.stringify(body, null, 2) : body;
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(payload);
}

function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'Forbidden' });
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, { error: 'Not found' });
    send(res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const query = Object.fromEntries(url.searchParams);

  if (url.pathname === '/api/health') {
    return send(res, 200, {
      ok: true,
      storage: USE_SUPABASE ? 'supabase' : 'json',
      key: USE_SUPABASE ? KEY_KIND : null,
      project: USE_SUPABASE ? SUPABASE_URL : null,
      time: nowISO(),
    });
  }
  if (!url.pathname.startsWith('/api/')) return serveStatic(res, url.pathname);

  const match = routes.find((r) => r.method === req.method && r.regex.test(url.pathname));
  if (!match) return send(res, 404, { error: `No route for ${req.method} ${url.pathname}` });

  const grabbed = match.regex.exec(url.pathname);
  const params = Object.fromEntries(match.names.map((n, i) => [n, decodeURIComponent(grabbed[i + 1])]));
  const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};

  try {
    send(res, 200, await match.handler(params, query, body));
  } catch (err) {
    send(res, err.status || 500, { error: err.message });
  }
});

init()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`AquaTrack Production backend running at http://localhost:${PORT}`);
      console.log(
        USE_SUPABASE
          ? `Storage: Supabase ${SUPABASE_URL} (${KEY_KIND} key)`
          : `Storage: data.json (${DB_FILE})`,
      );
      if (!USE_SUPABASE) {
        console.log('Tip: fill in config.json to use the shared Supabase database.');
      }
    });
  })
  .catch((err) => {
    console.error('\nStartup failed:', err.message);
    console.error(
      USE_SUPABASE
        ? [
            'Check that:',
            '  - config.json / .env has the right project URL',
            '  - supabase/schema.sql has been run in that project',
            '  - you are using the anon key or the service_role key (not a typo)',
            '  - the tables in supabase/schema.sql were granted to anon',
          ].join('\n')
        : '',
    );
    process.exit(1);
  });
