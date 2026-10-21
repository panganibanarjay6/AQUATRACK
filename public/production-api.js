/**
 * AquaTrack ERP — Production module front-end glue.
 * Loaded by index.html. Talks to the small Node backend in ../server.js.
 * Plain script (no build step): every screen is re-rendered from GET /api/bootstrap.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------- helpers */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('en-PH');
  const money = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const TONES = { ok: 'b-ok', blue: 'b-blue', warn: 'b-warn', bad: 'b-bad', purple: 'b-purple', dim: 'b-dim' };
  const badge = (text, tone = 'dim') => `<span class="badge ${TONES[tone] || 'b-dim'}">${esc(text)}</span>`;

  const ORDER_TONE = { material_pending: 'warn', ready: 'blue', in_progress: 'blue', completed: 'ok', cancelled: 'bad' };
  const ORDER_LABEL = {
    material_pending: 'Material request pending', ready: 'Ready to start',
    in_progress: '', completed: 'Completed', cancelled: 'Cancelled',
  };
  const REQ_TONE = { Pending: 'warn', Approved: 'ok', Issued: 'blue', Rejected: 'bad' };
  const PLAN_TONE = { Scheduled: 'blue', Pending: 'warn', Converted: 'ok' };
  const MACHINE_TONE = { Online: 'ok', 'Under Maintenance': 'warn', Offline: 'bad' };
  const FG_TONE = { 'In Stock': 'ok', 'Low Stock': 'warn' };

  function orderBadge(o) {
    const label = ORDER_LABEL[o.status] || o.status;
    if (o.status === 'in_progress') return badge(o.stage || 'In progress', 'blue');
    return badge(o.status === 'material_pending' && o.stage ? o.stage : label, ORDER_TONE[o.status]);
  }

  async function api(path, options) {
    const res = await fetch('/api' + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  const notify = (msg) => (typeof toast === 'function' ? toast(msg) : console.log(msg));

  /* --------------------------------------------------------------- modal */

  function openModal(title, fields, onSubmit) {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;inset:0;background:rgba(8,20,35,.55);display:flex;align-items:center;justify-content:center;z-index:300';

    const fieldHtml = fields
      .map((f) => {
        const base =
          'width:100%;padding:9px 11px;border:1px solid #d5e1ef;border-radius:9px;font-size:13px;background:#fff;color:#17293f';
        let input;
        if (f.type === 'select') {
          input = `<select name="${f.name}" style="${base}">${(f.options || [])
            .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
            .join('')}</select>`;
        } else if (f.type === 'textarea') {
          input = `<textarea name="${f.name}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || '')}" style="${base};resize:vertical">${esc(f.value || '')}</textarea>`;
        } else {
          input = `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}" style="${base}">`;
        }
        return `<label style="display:block;margin-bottom:12px">
          <span style="display:block;font-size:12px;color:#5b7089;margin-bottom:5px">${esc(f.label)}</span>${input}
        </label>`;
      })
      .join('');

    wrap.innerHTML = `<form style="background:#fff;border:1px solid #e4ebf4;border-radius:14px;padding:20px;width:min(440px,92vw);max-height:88vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.35)">
      <h3 style="margin:0 0 16px;font-size:16px;color:#17293f">${esc(title)}</h3>
      ${fieldHtml}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px">
        <button type="button" class="btn" data-cancel>Cancel</button>
        <button type="submit" class="btn primary">Save</button>
      </div>
    </form>`;

    const close = () => wrap.remove();
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    $('[data-cancel]', wrap).onclick = close;

    $('form', wrap).addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {};
      for (const f of fields) {
        const el = wrap.querySelector(`[name="${f.name}"]`);
        data[f.name] = f.type === 'number' ? Number(el.value) : el.value.trim();
      }
      try {
        await onSubmit(data);
        close();
      } catch (err) {
        notify(err.message);
      }
    });

    document.body.appendChild(wrap);
    const first = wrap.querySelector('input, select, textarea');
    if (first) first.focus();
  }

  function tableModal(title, rows) {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;inset:0;background:rgba(8,20,35,.55);display:flex;align-items:center;justify-content:center;z-index:300';
    const cols = rows.length ? Object.keys(rows[0]) : [];
    const head = cols.map((c) => `<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #e4ebf4;font-size:11px;text-transform:uppercase;color:#8ba0b8">${esc(c.replace(/_/g, ' '))}</th>`).join('');
    const body = rows.length
      ? rows.map((r) => `<tr>${cols.map((c) => `<td style="padding:8px 10px;border-bottom:1px solid #f1f5fb;font-size:13px">${esc(r[c])}</td>`).join('')}</tr>`).join('')
      : `<tr><td style="padding:14px;color:#8ba0b8">No data for this period.</td></tr>`;
    wrap.innerHTML = `<div style="background:#fff;border:1px solid #e4ebf4;border-radius:14px;padding:18px;width:min(680px,94vw);max-height:88vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.35)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h3 style="margin:0;font-size:16px">${esc(title)}</h3>
        <button class="btn" data-cancel>Close</button>
      </div>
      <table style="width:100%;border-collapse:collapse"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </div>`;
    const close = () => wrap.remove();
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    $('[data-cancel]', wrap).onclick = close;
    document.body.appendChild(wrap);
  }

  function csv(rows) {
    if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
  }

  async function downloadReport(kind, title) {
    const rows = kind === 'summary' ? [await api('/reports/summary')] : await api('/reports/' + kind);
    const blob = new Blob([csv(rows)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${kind}-report.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    notify(`${title} exported as CSV`);
  }

  /* ------------------------------------------------------------- rendering */

  let state = null;
  let selectedPlanDay = null;

  function setRows(tableId, rowsHtml) {
    const tbody = $(`#${tableId} tbody`);
    if (tbody) tbody.innerHTML = rowsHtml.join('');
  }

  function renderDashboardKpis() {
    const hub = $('#prod-hub');
    if (!hub) return;
    const cards = $$('.kpisq .kpi', hub);
    const d = state.dashboard;
    const set = (i, val, badgeText, tone) => {
      const card = cards[i];
      if (!card) return;
      const v = $('.val', card);
      if (v) v.textContent = val;
      const b = $('.badge', card);
      if (b && badgeText) b.outerHTML = badge(badgeText, tone);
    };
    set(0, d.active_orders, `${d.machines_online}/${d.machines_total} machines online`, 'blue');
    set(1, num(d.units_today), `${d.yield_pct}% yield`, 'ok');
    set(2, money(d.unit_cost), 'per gallon (standard)', 'purple');
    set(3, `${d.machines_online}/${d.machines_total}`,
      d.machines_total - d.machines_online > 0 ? `${d.machines_total - d.machines_online} under maintenance` : 'all online',
      d.machines_total - d.machines_online > 0 ? 'warn' : 'ok');
  }

  function renderProducts() {
    setRows('t-pm', state.products.map((p) => `<tr>
      <td><span class="mono">${esc(p.code)}</span></td>
      <td>${esc(p.name)}</td>
      <td>${esc(p.category)}</td>
      <td>${esc(p.unit)}</td>
      <td>${money(p.price)}</td>
      <td>${badge(p.is_active ? 'Active' : 'Inactive', p.is_active ? 'ok' : 'bad')}</td>
    </tr>`));
  }

  function renderBoms() {
    setRows('t-bom', state.boms.map((b) => `<tr>
      <td><span class="mono">${esc(b.code)}</span></td>
      <td>${esc(b.product_name)}</td>
      <td><ul class="mlist">${b.items.map((it) => `<li>${esc(it.material_name)}</li>`).join('')}</ul></td>
      <td>${badge(b.status, b.status === 'Active' ? 'ok' : 'dim')}</td>
    </tr>`));
  }

  function renderOrders() {
    setRows('t-po', state.orders.map((o) => `<tr>
      <td><span class="mono">${esc(o.code)}</span></td>
      <td>${esc(o.product_name)}</td>
      <td>${num(o.qty)}</td>
      <td><div class="progress" style="width:130px"><i style="width:${o.progress_pct}%"></i></div></td>
      <td>${orderBadge(o)}</td>
    </tr>`));
  }

  function renderPlans() {
    const plans = selectedPlanDay
      ? state.plans.filter((p) => p.plan_date === selectedPlanDay)
      : state.plans;
    setRows('t-pp', plans.map((p) => `<tr>
      <td>${esc(p.plan_date)}</td>
      <td>${esc(p.product_name)}</td>
      <td>${num(p.qty)}</td>
      <td>${badge(p.status, PLAN_TONE[p.status])}</td>
    </tr>`));
  }

  function renderMaterialRequests() {
    setRows('t-mr', state.material_requests.map((r) => `<tr>
      <td><span class="mono">${esc(r.code)}</span></td>
      <td>${esc(r.created_on)}</td>
      <td>${esc(r.product_name)}</td>
      <td>${num(r.qty_units)} pcs</td>
      <td>${badge(r.status, REQ_TONE[r.status])}</td>
    </tr>`));
  }

  function renderIssuances() {
    setRows('t-mi', state.issuances.map((i) => `<tr>
      <td><span class="mono">${esc(i.code)}</span></td>
      <td>${esc(i.date)}</td>
      <td>${esc(i.material_name)}</td>
      <td>${num(i.qty)} ${esc(i.uom)}</td>
      <td>${esc(i.issued_by)}</td>
      <td>${badge(i.status, 'ok')}</td>
    </tr>`));
  }

  function renderMachines() {
    setRows('t-ms', state.machines.map((m) => `<tr>
      <td>${esc(m.line_name)}</td>
      <td>${esc(m.name)}</td>
      <td>${badge(m.status, MACHINE_TONE[m.status])}</td>
      <td><small class="dim">${esc(m.note || '')}</small></td>
    </tr>`));
  }

  function renderFinishedGoods() {
    setRows('t-fg', state.finished_goods.map((f) => `<tr>
      <td><span class="mono">${esc(f.code)}</span></td>
      <td>${esc(f.product_name)}</td>
      <td>${num(f.qty)}</td>
      <td>${esc(f.record_date)}</td>
      <td>${badge(f.status, FG_TONE[f.status] || 'ok')}</td>
    </tr>`));
  }

  function renderCosting() {
    setRows('t-pc', state.costing.map((c) => `<tr>
      <td>${esc(c.product_name)}</td>
      <td>${money(c.material_cost)}</td>
      <td>${money(c.labor_cost)}</td>
      <td>${money(c.machine_cost)}</td>
      <td><b>${money(c.total_cost)}</b></td>
    </tr>`));
  }

  function renderAudit() {
    const tbody = $('#view-audit tbody');
    if (!tbody) return;
    tbody.innerHTML = state.audit.map((a) => `<tr>
      <td class="mono">${esc(new Date(a.at).toTimeString().slice(0, 5))}</td>
      <td>${esc(a.user)}</td>
      <td>${esc(a.action)}</td>
      <td>${badge(a.module, 'blue')}</td>
      <td class="mono">${esc(a.reference)}</td>
    </tr>`).join('');
  }

  function renderMonitoring() {
    const focus = state.orders.find((o) => o.status === 'in_progress') || state.orders[0];
    const panelA = $('#sp-a .g3');
    if (panelA && focus) {
      const timeline = focus.stages.map((s, i) => {
        const tone = s.status === 'completed' ? 'ok' : s.status === 'in_progress' ? 'blue' : 'warn';
        const label = s.status === 'completed' ? 'Completed' : s.status === 'in_progress' ? 'In Progress' : 'Pending';
        const time = s.started_at ? new Date(s.started_at).toTimeString().slice(0, 5) : '--:--';
        return `<div class="tli"><span class="mono">${time}</span><span>${esc(s.name)}</span>${badge(label, tone)}</div>`;
      }).join('');
      const steps = focus.stages.map((s) => {
        const cls = s.status === 'completed' ? 'sd done' : s.status === 'in_progress' ? 'sd now' : 'sd';
        const ck = s.status === 'completed' ? '<span class="ck">&#10003;</span>' : '';
        return `<div><i class="${cls}"></i>${esc(s.name)} ${ck}</div>`;
      }).join('');

      panelA.innerHTML = `
        <div class="card inner">
          <div class="cardtitle"><h3>${esc(focus.code)} &middot; ${esc(focus.product_name)}</h3></div>
          <div class="ringwrap">
            <div class="ring"><div class="rhole"><b>${focus.progress_pct}%</b></div></div>
            <div class="rsteps">${steps}</div>
          </div>
        </div>
        <div class="card inner">
          <div class="cardtitle"><h3>Production Timeline</h3></div>
          <div class="tl">${timeline}</div>
        </div>
        <div class="card inner">
          <div class="cardtitle"><h3>Machine Status</h3></div>
          ${state.machines.map((m) => `<div class="mach">
            <span class="mic ${m.status === 'Online' ? 'ok' : 'warn'}"></span>
            <b>${esc(m.name)}</b>
            ${badge(m.status, MACHINE_TONE[m.status])}
          </div>`).join('')}
        </div>`;
    }

    const panelC = $('#sp-c .grid');
    if (panelC) {
      panelC.innerHTML = state.orders
        .filter((o) => ['material_pending', 'ready', 'in_progress'].includes(o.status))
        .map((o) => {
          const done = Math.round((o.qty * o.progress_pct) / 100);
          return `<div class="card inner">
            <div class="cardtitle"><h3>${esc(o.code)}</h3>${badge(o.stage || 'Waiting', o.status === 'material_pending' ? 'warn' : 'blue')}</div>
            <div style="font-size:13px;margin-bottom:10px">${esc(o.product_name)}</div>
            <div class="progress"><i style="width:${o.progress_pct}%"></i></div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px">
              <span class="mut">${num(done)} of ${num(o.qty)}</span><b>${o.progress_pct}%</b>
            </div>
          </div>`;
        })
        .join('');
    }
  }

  function renderCalendar() {
    const grid = $('#pf-4 .calgrid');
    if (!grid) return;
    const days = new Set(state.plans.map((p) => p.plan_date));
    $$('.dc', grid).forEach((cell) => {
      const day = cell.textContent.trim();
      const iso = day.length === 1 ? `2026-10-0${day}` : `2026-10-${day}`;
      if (cell.classList.contains('off')) return;
      cell.classList.toggle('has', days.has(iso));
      cell.classList.toggle('sel', selectedPlanDay === iso);
      cell.style.cursor = 'pointer';
      cell.onclick = () => {
        selectedPlanDay = selectedPlanDay === iso ? null : iso;
        renderPlans();
        renderCalendar();
      };
    });
  }

  function fillSelect(el, rows, placeholder) {
    if (!el) return;
    const current = el.value;
    const opts = rows.map((r) => `<option value="${esc(r.value)}">${esc(r.label)}</option>`).join('');
    el.innerHTML = (rows.length ? '' : `<option value="">${esc(placeholder)}</option>`) + opts;
    if (rows.some((r) => r.value === current)) el.value = current;
  }

  function renderToolbars() {
    fillSelect($('#poSelect'), state.orders.map((o) => ({
      value: o.id,
      label: `${o.code} · ${o.product_name} · ${o.status}`,
    })), 'No production orders');
    fillSelect($('#mrSelect'), state.material_requests.filter((r) => r.status === 'Pending').map((r) => ({
      value: r.id,
      label: `${r.code} · ${r.order_code} · ${r.qty_units} pcs`,
    })), 'No pending request');
    fillSelect($('#planSelect'), state.plans.filter((p) => p.status !== 'Converted').map((p) => ({
      value: p.id,
      label: `${p.plan_date} · ${p.product_name} · ${num(p.qty)}`,
    })), 'No open plan');
  }

  function renderAll() {
    renderDashboardKpis();
    renderProducts();
    renderBoms();
    renderOrders();
    renderPlans();
    renderMaterialRequests();
    renderIssuances();
    renderMachines();
    renderFinishedGoods();
    renderCosting();
    renderMonitoring();
    renderCalendar();
    renderToolbars();
    renderAudit();
  }

  async function refresh() {
    state = await api('/bootstrap');
    renderAll();
    return state;
  }

  async function action(promise, okMessage) {
    try {
      await promise;
      await refresh();
      notify(okMessage);
    } catch (err) {
      notify(err.message);
    }
  }

  /* -------------------------------------------------------------- buttons */

  const productOptions = () => state.products.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }));
  const orderOptions = (fn = () => true) =>
    state.orders.filter(fn).map((o) => ({ value: o.id, label: `${o.code} · ${o.product_name}` }));

  function bind(panel, label, handler) {
    const root = $(panel);
    if (!root) return;
    const btn = $$('button', root).find((b) => b.textContent.trim().toLowerCase().includes(label.toLowerCase()));
    if (btn) btn.onclick = handler;
  }

  function wireButtons() {
    // 1. Product master
    bind('#pf-1', '+ Add Product', () =>
      openModal('Add Product', [
        { name: 'name', label: 'Product name' },
        { name: 'category', label: 'Category', type: 'select', options: [
          { value: 'Drinking Water', label: 'Drinking Water' },
          { value: 'Bottled', label: 'Bottled' },
        ] },
        { name: 'unit', label: 'Unit', placeholder: '5 gal' },
        { name: 'price', label: 'Price', type: 'number', value: 0 },
      ], (data) => action(api('/products', { method: 'POST', body: JSON.stringify(data) }), `Product ${data.name} added`)));

    // 2. BOM
    bind('#pf-2', '+ New BOM', () =>
      openModal('New Bill of Materials', [
        { name: 'product_id', label: 'Product', type: 'select', options: productOptions() },
        { name: 'items', label: 'Materials (one per line: name, qty per unit, unit, cost)',
          type: 'textarea', rows: 5, placeholder: 'Purified Water, 20, L, 0.075\nEmpty 5-gal gallon, 1, unit, 2' },
      ], (data) => {
        const items = data.items.split('\n').map((line) => line.split(',')).filter((p) => p[0] && p[0].trim())
          .map((p) => ({ material_name: p[0].trim(), qty_per_unit: Number(p[1]) || 0, uom: (p[2] || 'unit').trim(), std_unit_cost: Number(p[3]) || 0 }));
        return action(api('/boms', { method: 'POST', body: JSON.stringify({ product_id: data.product_id, items }) }), 'BOM created');
      }));

    // 3. Production order
    bind('#pf-3', '+ Production Order', () =>
      openModal('New Production Order', [
        { name: 'product_id', label: 'Product', type: 'select', options: productOptions() },
        { name: 'qty', label: 'Quantity', type: 'number', value: 500 },
        { name: 'planned_start', label: 'Planned start', placeholder: 'YYYY-MM-DD' },
      ], (data) => action(api('/orders', { method: 'POST', body: JSON.stringify(data) }), 'Production order created')));

    // 4. Planning
    bind('#pf-4', '+ Create Plan', () =>
      openModal('Create Production Plan', [
        { name: 'plan_date', label: 'Date', placeholder: '2026-10-20' },
        { name: 'product_id', label: 'Product', type: 'select', options: productOptions() },
        { name: 'qty', label: 'Quantity', type: 'number', value: 500 },
      ], (data) => action(api('/plans', { method: 'POST', body: JSON.stringify(data) }), 'Production run added to schedule')));

    // 5. Material requirement
    bind('#pf-5', '+ Generate Request', () => {
      const candidates = state.orders.filter((o) => ['material_pending', 'ready'].includes(o.status));
      if (!candidates.length) return notify('No order is waiting for materials');
      openModal('Generate Material Request', [
        { name: 'order_id', label: 'Production order', type: 'select', options: candidates.map((o) => ({ value: o.id, label: `${o.code} · ${o.product_name}` })) },
        { name: 'qty_units', label: 'Units (blank = whole order)', type: 'number', value: 0 },
      ], (data) => action(
        api('/material-requests', { method: 'POST', body: JSON.stringify({ order_id: data.order_id, qty_units: data.qty_units || undefined }) }),
        'Material request generated',
      ));
    });

    // 6. Material issuance
    bind('#pf-6', '+ Issue Materials', () => {
      const approved = state.material_requests.filter((r) => r.status === 'Approved');
      if (!approved.length) return notify('No approved material request to issue');
      openModal('Issue Materials', [
        { name: 'request_id', label: 'Material request', type: 'select', options: approved.map((r) => ({ value: r.id, label: `${r.code} · ${r.order_code}` })) },
      ], (data) => action(api('/issuances', { method: 'POST', body: JSON.stringify({ request_id: data.request_id }) }), 'Materials issued to production'));
    });

    // 8. Finished goods
    bind('#pf-8', '+ Record Finished Goods', () => {
      const options = orderOptions((o) => o.status === 'in_progress' || o.status === 'completed');
      if (!options.length) return notify('No order to record output for');
      openModal('Record Finished Goods', [
        { name: 'order_id', label: 'Production order', type: 'select', options },
        { name: 'qty', label: 'Quantity good', type: 'number', value: 100 },
      ], (data) => action(api('/finished-goods', { method: 'POST', body: JSON.stringify(data) }), 'Finished goods recorded to Inventory'));
    });

    // 9. Costing
    const today = new Date().toISOString().slice(0, 10);
    bind('#pf-9', '+ Calculate Cost', () =>
      openModal('Calculate Production Cost', [
        { name: 'start', label: 'From', value: today.slice(0, 8) + '01' },
        { name: 'end', label: 'To', value: today },
      ], (data) => action(api('/costing/calculate', { method: 'POST', body: JSON.stringify(data) }), 'Cost calculation posted to Finance')));

    // 10. Reports
    const reportPanel = $('#pf-10');
    if (reportPanel) {
      const kinds = ['summary', 'material-usage', 'cost', 'finished-goods'];
      const titles = ['Production Summary', 'Material Usage Report', 'Production Cost Report', 'Finished Goods Report'];
      $$('.repcard', reportPanel).forEach((card, i) => {
        const btn = $$('button', card)[0];
        if (!btn) return;
        btn.onclick = async () => {
          try {
            const rows = kinds[i] === 'summary' ? [await api('/reports/summary')] : await api('/reports/' + kinds[i]);
            tableModal(titles[i], rows);
          } catch (err) {
            notify(err.message);
          }
        };
      });
      const exportBtn = $$('button', reportPanel).find((b) => b.textContent.includes('Export'));
      if (exportBtn) exportBtn.onclick = () => downloadReport('summary', 'Production summary');
    }

    // 7. Monitoring — machine status changes
    const machineTable = $('#t-ms');
    if (machineTable) {
      machineTable.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        const line = row.children[0].textContent.trim();
        const machine = state.machines.find((m) => m.line_name === line);
        if (!machine) return;
        const next = machine.status === 'Online' ? 'Under Maintenance' : 'Online';
        action(
          api('/machines/' + machine.id, { method: 'PATCH', body: JSON.stringify({ status: next, note: next === 'Online' ? 'Back online' : 'Scheduled maintenance' }) }),
          `${machine.name} set to ${next}`,
        );
      });
    }
  }

  function wireToolbars() {
    const run = (path, ok, body) => {
      const id = $('#poSelect')?.value;
      if (!id) return notify('No production order selected');
      action(api(`/orders/${id}/${path}`, { method: 'POST', body: JSON.stringify(body || {}) }), ok);
    };
    const on = (sel, handler) => { const el = $(sel); if (el) el.onclick = handler; };

    on('#poStart', () => run('start', 'Order started'));
    on('#poAdvance', () => run('advance', 'Stage advanced'));
    on('#poComplete', () => run('complete', 'Order completed — finished goods and cost posted'));
    on('#poCancel', () => run('cancel', 'Order cancelled'));
    on('#poOutput', () => {
      const id = $('#poSelect')?.value;
      if (!id) return notify('No production order selected');
      openModal('Record Output', [
        { name: 'qty_good', label: 'Good units', type: 'number', value: 100 },
        { name: 'qty_rejected', label: 'Rejected units', type: 'number', value: 0 },
      ], (data) => action(
        api(`/orders/${id}/output`, { method: 'POST', body: JSON.stringify(data) }),
        `Output recorded for order`,
      ));
    });

    on('#mrApprove', () => {
      const id = $('#mrSelect')?.value;
      if (!id) return notify('No pending material request');
      action(api(`/material-requests/${id}/approve`, { method: 'POST' }), 'Material request approved');
    });
    on('#mrReject', () => {
      const id = $('#mrSelect')?.value;
      if (!id) return notify('No pending material request');
      action(api(`/material-requests/${id}/reject`, { method: 'POST' }), 'Material request rejected');
    });

    on('#planConvert', () => {
      const id = $('#planSelect')?.value;
      if (!id) return notify('No open plan selected');
      action(api(`/plans/${id}/convert`, { method: 'POST' }), 'Plan converted to a production order');
    });
  }

  /* ------------------------------------------------------------------ boot */

  async function boot() {
    try {
      await refresh();
      wireButtons();
      wireToolbars();
    } catch (err) {
      notify('Backend not reachable: ' + err.message);
      console.warn('[AquaTrack] run `node server.js` and open http://localhost:4000');
    }
  }

  // The page is plain HTML; wait for it to finish parsing.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // expose for quick console poking
  window.AquaTrack = { api, refresh, get state() { return state; } };
})();
