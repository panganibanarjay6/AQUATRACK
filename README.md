# AquaTrack ERP — Production module backend

A small, dependency-free backend for the **Production & Manufacturing** screens of
`aquatrack-erp-ui_v3.html` (Team 3's module).

* Node.js built-ins only — **no `npm install`**
* Data lives in `data.json` (created automatically from `seed.js` on first run)
* Serves the UI and a REST API from the same port

```bash
cd "AquaTrack production"
node server.js
# -> AquaTrack Production backend running at http://localhost:4000
```

Open <http://localhost:4000>. Delete `data.json` to reset back to the seed data.

## Backups

Snapshot the working files before a change:

```bash
npm run backup              # backups/aquatrack-snapshot-YYYY-MM-DD-HHMMSS.zip
npm run backup -- cancel    # same, with a label
```

`backups/` is git-ignored, so the zips stay local and never bloat the repo.

## Files

| File | What it is |
|---|---|
| `server.js` | The whole backend: JSON store, business rules, REST API, static file server |
| `seed.js` | Starting data that matches the numbers already in the UI mock-up |
| `public/index.html` | The original UI, plus the client script and a few action toolbars |
| `public/styles.css` | Stylesheet, including the mobile layout rules |
| `public/production-api.js` | Front-end glue: renders every Production screen from the API and wires the buttons |
| `backup.ps1` | Creates a timestamped zip snapshot in `backups/` (`npm run backup`) |
| `data.json` | Runtime data used when Supabase is not configured (delete to reset) |
| `supabase/schema.sql` | The database tables — run once in Supabase |
| `.env.example` | Template for your Supabase URL and service key |

## Configuring the database (do this once)

The server reads its settings from `config.json` (committed) and optionally `.env`
(not committed). Priority: environment variables → `.env` → `config.json`.

### 1. Create the tables

1. Supabase → **SQL Editor → New query**.
2. Paste the whole of `supabase/schema.sql` → **Run**.
3. Expect *"Success. No rows returned"* and 13 `production_*` tables in **Table Editor**.

### 2. Fill in `config.json`

Open **Settings → API** and copy the **Project URL** and the **anon / publishable**
key (`sb_publishable_...`, or the long `eyJ...` key labelled `anon`):

```json
{
  "SUPABASE_URL": "https://your-project-ref.supabase.co",
  "SUPABASE_ANON_KEY": "sb_publishable_...",
  "PORT": 4000
}
```

Commit it. That is what makes "clone and run" work for the whole team: anyone who
clones the repo runs `node server.js` and is connected, with no `.env` and no setup.

### 3. Optional: your own admin key

For local work you can put the **service_role / secret** key in `.env`. It overrides
`config.json` and is git-ignored, so it is never committed:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=sb_secret_...
```

### 4. Run it

```bash
node server.js
```

```
AquaTrack Production backend running at http://localhost:4000
Storage: Supabase https://xxxx.supabase.co (anon key)
Seeded the Supabase database with the demo data.
```

Check with:

```bash
curl http://localhost:4000/api/health
# {"ok":true,"storage":"supabase","key":"anon","project":"https://xxxx.supabase.co", ...}
```

On the first run against an empty database the server uploads the demo data, so the
UI is not blank.

> **What the two keys mean**
>
> | Key | Where it goes | Safe to share? |
> |---|---|---|
> | `anon` / publishable | `config.json` (committed) | Yes — it is public by design |
> | `service_role` / secret | `.env` (git-ignored) only | **No — it bypasses all security** |
>
> Because the anon key is in the repo and the tables have Row Level Security off,
> **this database is demo data only**. Anyone with repo access can read, change or
> delete its rows. Never put real or personal data in it. If a secret key is ever
> committed, rotate it immediately in **Settings → API**.

If both `config.json` and `.env` are empty, the server quietly falls back to
`data.json`, so the app still runs offline.

## Working with the rest of the team

Everyone clones the same repo and checks out their own branch:

```bash
git clone https://github.com/panganibanarjay6/AQUATRACK.git
cd AQUATRACK
git checkout PRODUCTION          # or PROCUREMENT, INVENTORY, ...
node server.js
```

They get the shared Supabase database from `config.json` automatically. Teams 1, 2,
4 and 5 add their own tables to the same Supabase project; the `production_events`
table is the outbox the Production module writes for Inventory and Finance.

Only commit code to your own branch. Never `git push --force`, and never push to
`main`.

## What the UI features map to

| # | Screen | API |
|---|---|---|
| 1 | Product Master | `GET/POST /api/products`, `PATCH /api/products/:id` |
| 2 | Bill of Materials | `GET/POST /api/boms` |
| 3 | Production Order | `GET/POST /api/orders`, `POST /api/orders/:id/{start,advance,output,complete,cancel}` |
| 4 | Production Planning | `GET/POST /api/plans`, `POST /api/plans/:id/convert` |
| 5 | Material Requirement | `GET/POST /api/material-requests`, `POST /api/material-requests/:id/{approve,reject}` |
| 6 | Material Issuance | `GET /api/issuances`, `POST /api/issuances` |
| 7 | Production Monitoring | `GET /api/machines`, `PATCH /api/machines/:id`, `GET /api/orders/:id/timeline` |
| 8 | Finished Goods | `GET/POST /api/finished-goods` |
| 9 | Production Costing | `GET /api/costing/standard`, `POST /api/costing/calculate` |
| 10 | Production Reports | `GET /api/reports/{summary,material-usage,cost,finished-goods}` |
| — | Dashboard KPIs | `GET /api/dashboard` or `GET /api/bootstrap` |
| — | Cross-module hand-off | `GET /api/events` (outbox for Inventory / Finance) |
| — | Audit Trail | `GET /api/audit` |

`GET /api/bootstrap` returns everything the ten screens need in one call; the client
re-fetches it after every change.

## The production order life-cycle

```
draft/material_pending --generate request--> MR pending
       --approve--> MR approved --issue--> ready --start--> in_progress
       --> completed   (finished goods + cost posting + events are created automatically)
```

Rules enforced by the server (not just the UI):

* an order must have an **active BOM** before it can be created
* materials can only be issued against an **approved** request (once only)
* an order can only `start` when it is `ready`
* `complete` only works on an `in_progress` order, and it then writes a finished-goods
  record, a cost posting, an audit line and two integration events

### Try the whole flow with curl / PowerShell

```bash
# 1. create an order
curl -X POST localhost:4000/api/orders -H "Content-Type: application/json" \
     -d '{"product_id":"p3","qty":300}'

# 2. explode its BOM into a material request   (order_id from step 1)
curl -X POST localhost:4000/api/material-requests -H "Content-Type: application/json" \
     -d '{"order_id":"<ORDER_ID>"}'

# 3. approve it, then issue the stock out      (request_id from step 2)
curl -X POST localhost:4000/api/material-requests/<MR_ID>/approve
curl -X POST localhost:4000/api/issuances -H "Content-Type: application/json" \
     -d '{"request_id":"<MR_ID>"}'

# 4. run the order
curl -X POST localhost:4000/api/orders/<ORDER_ID>/start
curl -X POST localhost:4000/api/orders/<ORDER_ID>/advance
curl -X POST localhost:4000/api/orders/<ORDER_ID>/output -H "Content-Type: application/json" \
     -d '{"qty_good":290,"qty_rejected":10}'
curl -X POST localhost:4000/api/orders/<ORDER_ID>/complete
```

Errors come back as `{"error":"..."}` with a 400/404 status.

## In the UI, what is wired up

* every table is rendered from the API (products, BOMs, orders, plans, requests,
  issuances, machines, finished goods, costing, audit)
* the four hub KPI cards, the monitoring ring/timeline/machines and the
  Order Progress cards
* the October 2026 planning calendar marks days that have plans (click a day to filter)
* **+ buttons** open a small modal and post to the API
* **Order actions** toolbar: Start / Advance stage / Record output / Complete / Cancel
* **Request actions** toolbar: Approve / Reject
* **Plan actions** toolbar: Convert to Order
* clicking a row in Machine Status flips Online ⇄ Under Maintenance
* **Calculate Cost** and the four report cards (view + CSV export)

## Production costing

Material cost comes from the BOM (`qty_per_unit × std_unit_cost`), labour and machine
cost from `cost_rates`. The standard cost table therefore reproduces the UI's numbers:

| Product | Material | Labour | Machine | Total |
|---|---|---|---|---|
| 5-gal Refill Water | ₱4.20 | ₱1.50 | ₱1.10 | **₱6.80** |
| 50 ml Bottled Water | ₱2.10 | ₱0.80 | ₱0.60 | **₱3.50** |
| 1 L Bottled Water | ₱3.00 | ₱1.00 | ₱0.90 | **₱4.90** |

## Outbox events (for Teams 2 and 5)

| event_type | target | when |
|---|---|---|
| `production.material_requested` | inventory | a material request is generated |
| `production.material_issued` | inventory | each issuance line |
| `production.finished_goods_recorded` | inventory | goods recorded (manual or auto on completion) |
| `production.order_completed` | finance | order completed (with unit / total cost) |

## Things I noticed while reviewing the UI

1. **Two different unit costs.** The dashboard badge and `JE-2213` imply ₱9.80/gallon,
   but the Production Costing screen (and this backend's BOM + rate data) gives **₱6.80**.
   `18,228 / 1,860 = 9.80`, so the journal entry is the odd one out.
2. **Product Master's "Price" column is really a cost.** 5-gal refill shows ₱9.80 while
   Sales sells `SO-1338` at `7,200 / 120 = ₱60`. The column should be relabelled (cost)
   or fed from Sales.
3. **PRO-0219 disagrees with itself**: the order list says *Purifying*, Monitoring says
   *Bottling*; progress is 64% in one place and 75% in another. The backend computes one
   value from the stage list.
4. **Quantities don't reconcile.** BOM says 20 L of treated water per 5-gal gallon, but
   `ISS-001` issues only `20 L` for a 1,860-gallon run.
5. **Broken HTML in the mock-up** (e.g. `</div` + newline + `>`, `<td class="mut">…<td>`,
   `<th>Credit</th` … ) — browsers recover, but it is fragile to edit.
6. **Placeholders everywhere.** Search boxes, Filter buttons, `.tag` counters (2, 3) and
   the sidebar do nothing; the page date is hard-coded ("Sunday, Sep 27, 2026", the
   calendar says October 2026).
7. **Accessibility.** `.navitem`s are clickable `div`s — no `tabindex`, no `role`, no
   keyboard support — and the icon-only buttons have no `aria-label`.
