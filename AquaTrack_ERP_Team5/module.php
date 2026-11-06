<?php
require_once 'includes/accounting.php';
require_login();
$mods = [
 'procurement' => ['Procurement & Purchasing', 'Team 1', 'fa-box-open', 'Purchase invoices go to Accounts Payable and the journal.', 'api/erp.php?action=purchase_invoice'],
 'inventory'   => ['Inventory & Warehouse', 'Team 2', 'fa-layer-group', 'Stock value and cost of goods use the Inventory (1200) and COGS (5000) accounts.', 'api/erp.php?action=production_cost'],
 'production'  => ['Production & Manufacturing', 'Team 3', 'fa-droplet', 'Production cost is posted to cost accounting (Dr COGS, Cr Inventory).', 'api/erp.php?action=production_cost'],
 'sales'       => ['Sales & CRM', 'Team 4', 'fa-cart-shopping', 'Sales invoices go to Accounts Receivable, then collections.', 'api/erp.php?action=sales_invoice']];
$k = $_GET['m'] ?? ''; $m = $mods[$k] ?? null;
page_start($m ? $m[0] : 'Module'); ?>
<div class="mod"><?php if ($m): ?><i class="fa-solid <?= $m[2] ?> big"></i>
<h3><?= e($m[0]) ?></h3><p>This module is built by <b><?= e($m[1]) ?></b> and will plug into this menu once their pages are merged into the shared ERP.</p>
<p><b>Finance integration:</b> <?= e($m[3]) ?></p><p>Endpoint: <code><?= e($m[4]) ?></code> (send <code>X-API-KEY</code>, see config/db.php)</p>
<?php else: ?><p>Unknown module.</p><?php endif; ?></div>
<?php page_end();
