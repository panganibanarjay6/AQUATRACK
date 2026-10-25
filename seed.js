'use strict';
/**
 * Seed data for the AquaTrack Production module.
 * Matches the numbers already shown in public/index.html.
 */

const iso = (d) => d.toISOString();
const day = (d) => iso(new Date(d)).slice(0, 10);

// fixed "today" so the demo data lines up with the UI screenshots
const TODAY = new Date();

module.exports = function seed() {
  const products = [
    { id: 'p1', code: 'PRD-001', name: '5-gal Refill Water', category: 'Drinking Water', unit: '5 gal', price: 9.8, is_active: true },
    { id: 'p2', code: 'PRD-002', name: '50 ml Bottled Water', category: 'Bottled', unit: '50 ml', price: 6.5, is_active: true },
    { id: 'p3', code: 'PRD-003', name: '1 L Bottled Water', category: 'Bottled', unit: '1 L', price: 12, is_active: true },
    { id: 'p4', code: 'PRD-004', name: '500 ml Bottled Water', category: 'Bottled', unit: '500 ml', price: 10, is_active: true },
    { id: 'p5', code: 'PRD-005', name: '20 L Refill Water', category: 'Drinking Water', unit: '20 L', price: 35, is_active: false },
  ];

  const bomItems = (rows) =>
    rows.map(([material_name, qty_per_unit, uom, std_unit_cost]) => ({
      id: material_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      material_name,
      material_code: material_name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 12),
      qty_per_unit,
      uom,
      std_unit_cost,
    }));

  const boms = [
    {
      id: 'b1', code: 'BOM-001', product_id: 'p1', status: 'Active',
      items: bomItems([
        ['Purified Water (treated)', 20, 'L', 0.075], // 1.50
        ['Empty 5-gal gallon', 1, 'unit', 2.0],
        ['Bottle cap', 1, 'unit', 0.4],
        ['Product label', 1, 'unit', 0.3],
      ]),
    },
    {
      id: 'b2', code: 'BOM-002', product_id: 'p2', status: 'Active',
      items: bomItems([
        ['Bottle', 1, 'unit', 1.6],
        ['Cap', 1, 'unit', 0.3],
        ['Label', 1, 'unit', 0.2],
      ]),
    },
    {
      id: 'b3', code: 'BOM-003', product_id: 'p3', status: 'Active',
      items: bomItems([
        ['Bottle', 1, 'unit', 2.3],
        ['Cap', 1, 'unit', 0.3],
        ['Label', 1, 'unit', 0.4],
      ]),
    },
  ];

  const STAGES = ['Disinfection', 'Purifying', 'Bottling', 'Packaging'];
  const stagesUpTo = (last) =>
    STAGES.map((name) => {
      const i = STAGES.indexOf(name);
      const done = i <= last;
      const now = i === last + 1;
      return {
        name,
        status: done ? 'completed' : now ? 'in_progress' : 'pending',
        started_at: done || now ? iso(new Date(TODAY.getTime() - (STAGES.length - i) * 3600000)) : null,
        completed_at: done ? iso(new Date(TODAY.getTime() - (STAGES.length - i) * 1800000)) : null,
      };
    });

  const orders = [
    {
      id: 'o1', code: 'PRO-0219', product_id: 'p1', qty: 1860, status: 'in_progress',
      stage: 'Bottling', progress_pct: 50, planned_start: day(TODAY), notes: null,
      created_at: iso(new Date(TODAY.getTime() - 8 * 3600000)),
      stages: stagesUpTo(1),
      output: [{ id: 'ol1', qty_good: 1200, qty_rejected: 20, at: iso(new Date(TODAY.getTime() - 3600000)) }],
    },
    {
      id: 'o2', code: 'PRO-0220', product_id: 'p2', qty: 200, status: 'in_progress',
      stage: 'Bottling', progress_pct: 50, planned_start: day(TODAY), notes: null,
      created_at: iso(new Date(TODAY.getTime() - 6 * 3600000)),
      stages: stagesUpTo(1),
      output: [{ id: 'ol2', qty_good: 82, qty_rejected: 0, at: iso(new Date(TODAY.getTime() - 1800000)) }],
    },
    {
      id: 'o3', code: 'PRO-0221', product_id: 'p1', qty: 900, status: 'material_pending',
      stage: null, progress_pct: 0, planned_start: day(new Date(TODAY.getTime() + 86400000)), notes: 'Waiting on material request',
      created_at: iso(new Date(TODAY.getTime() - 2 * 3600000)),
      stages: stagesUpTo(-1),
      output: [],
    },
  ];

  const plans = [
    { id: 'pl1', plan_date: '2026-10-10', product_id: 'p1', qty: 1000, status: 'Scheduled' },
    { id: 'pl2', plan_date: '2026-10-11', product_id: 'p2', qty: 500, status: 'Scheduled' },
    { id: 'pl3', plan_date: '2026-10-12', product_id: 'p3', qty: 300, status: 'Pending' },
    { id: 'pl4', plan_date: '2026-10-13', product_id: 'p1', qty: 800, status: 'Scheduled' },
  ];

  const material_requests = [
    {
      id: 'mr1', code: 'MR-001', order_id: 'o3', qty_units: 900, status: 'Pending', created_at: iso(TODAY),
      lines: [
        { id: 'mrl1', material_name: 'Purified Water (treated)', material_code: 'PURIFIED-WAT', qty: 18000, uom: 'L', issued_qty: 0 },
        { id: 'mrl2', material_name: 'Empty 5-gal gallon', material_code: 'EMPTY-5-GAL', qty: 900, uom: 'unit', issued_qty: 0 },
      ],
    },
    {
      id: 'mr2', code: 'MR-002', order_id: 'o2', qty_units: 200, status: 'Approved', created_at: iso(TODAY),
      lines: [
        { id: 'mrl3', material_name: 'Bottle', material_code: 'BOTTLE', qty: 200, uom: 'unit', issued_qty: 0 },
        { id: 'mrl4', material_name: 'Cap', material_code: 'CAP', qty: 200, uom: 'unit', issued_qty: 0 },
        { id: 'mrl5', material_name: 'Label', material_code: 'LABEL', qty: 200, uom: 'unit', issued_qty: 0 },
      ],
    },
    {
      id: 'mr3', code: 'MR-003', order_id: 'o1', qty_units: 500, status: 'Approved', created_at: iso(TODAY),
      lines: [
        { id: 'mrl6', material_name: 'Purified Water (treated)', material_code: 'PURIFIED-WAT', qty: 10000, uom: 'L', issued_qty: 0 },
        { id: 'mrl7', material_name: 'Bottle cap', material_code: 'BOTTLE-CAP', qty: 500, uom: 'unit', issued_qty: 0 },
        { id: 'mrl8', material_name: 'Product label', material_code: 'PRODUCT-LABE', qty: 500, uom: 'unit', issued_qty: 0 },
      ],
    },
  ];

  const issuances = [
    { id: 'is1', code: 'ISS-001', date: day(TODAY), order_id: 'o1', request_id: 'mr3', material_name: 'Purified Water', material_code: 'PURIFIED-WAT', qty: 20, uom: 'L', issued_by: 'J. Santos', status: 'Issued' },
    { id: 'is2', code: 'ISS-002', date: day(TODAY), order_id: 'o1', request_id: 'mr3', material_name: 'Bottle Caps', material_code: 'BOTTLE-CAP', qty: 1000, uom: 'pcs', issued_by: 'M. Cruz', status: 'Issued' },
    { id: 'is3', code: 'ISS-003', date: day(new Date(TODAY.getTime() - 86400000)), order_id: 'o1', request_id: 'mr3', material_name: 'Product Labels', material_code: 'PRODUCT-LABE', qty: 1000, uom: 'pcs', issued_by: 'A. Reyes', status: 'Issued' },
  ];

  const machines = [
    { id: 'm1', line_name: 'Line A', name: 'Purifier', status: 'Online', note: '98.2% yield' },
    { id: 'm2', line_name: 'Line B', name: 'Filler', status: 'Online', note: 'On target' },
    { id: 'm3', line_name: 'Line C', name: 'Labeler', status: 'Under Maintenance', note: 'Back in about 2 hrs' },
  ];

  const finished_goods = [
    { id: 'fg1', code: 'FG-001', order_id: 'o1', product_id: 'p1', qty: 1000, record_date: day(TODAY), status: 'In Stock' },
    { id: 'fg2', code: 'FG-002', order_id: 'o2', product_id: 'p2', qty: 2000, record_date: day(TODAY), status: 'In Stock' },
    { id: 'fg3', code: 'FG-003', order_id: 'o1', product_id: 'p3', qty: 1500, record_date: day(new Date(TODAY.getTime() - 86400000)), status: 'In Stock' },
    { id: 'fg4', code: 'FG-004', order_id: 'o1', product_id: 'p1', qty: 800, record_date: day(new Date(TODAY.getTime() - 2 * 86400000)), status: 'Low Stock' },
  ];

  const cost_rates = [
    { id: 'cr1', product_id: 'p1', labor_per_unit: 1.5, machine_per_unit: 1.1, effective_from: '2026-01-01' },
    { id: 'cr2', product_id: 'p2', labor_per_unit: 0.8, machine_per_unit: 0.6, effective_from: '2026-01-01' },
    { id: 'cr3', product_id: 'p3', labor_per_unit: 1.0, machine_per_unit: 0.9, effective_from: '2026-01-01' },
  ];

  const audit = [
    { id: 'a1', at: new Date(TODAY.getTime() - 4 * 3600000).toISOString(), user: 'J. Reyes', action: 'Issued raw materials to production', module: 'Inventory', reference: 'MI-0338' },
    { id: 'a2', at: new Date(TODAY.getTime() - 5.5 * 3600000).toISOString(), user: 'System', action: 'Finished goods auto stock-in', module: 'Production', reference: 'PRO-0219' },
  ];

  return {
    products,
    boms,
    orders,
    plans,
    material_requests,
    issuances,
    machines,
    finished_goods,
    cost_rates,
    cost_summaries: [],
    cost_postings: [],
    audit,
    events: [],
  };
};
