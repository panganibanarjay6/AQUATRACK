<?php
require_once 'includes/accounting.php';
require_role(ACC_ROLES);
require_acc_branch();
$tab = $_GET['tab'] ?? 'tb';
$from = $_GET['from'] ?? date('Y-m-01'); $to = $_GET['to'] ?? date('Y-m-d');
$tot = account_totals($pdo, $tab === 'is' ? $from : null, $to);
$sum = function ($type) use ($tot) { $s = 0; foreach ($tot as $r) if ($r['account_type'] === $type) $s += normal_balance($type, $r['dr'], $r['cr']); return $s; };
$rowsOf = function ($type) use ($tot) { $o = ''; foreach ($tot as $r) if ($r['account_type'] === $type) $o .= '<tr><td>' . e($r['account_code'] . ' - ' . $r['account_name']) . '</td><td class="r">' . money(normal_balance($type, $r['dr'], $r['cr'])) . '</td></tr>'; return $o; };
$tr = fn($l, $v) => '<tr class="tot"><td>' . $l . '</td><td class="r">' . money($v) . '</td></tr>';
page_start('Financial Statements'); ?>
<div class="box"><form method="GET"><input type="hidden" name="tab" value="<?= e($tab) ?>">
<?php if ($tab === 'is'): ?>From <input type="date" name="from" value="<?= e($from) ?>"> <?php endif; ?>
<?= $tab === 'is' ? 'To' : 'As of' ?> <input type="date" name="to" value="<?= e($to) ?>"> <button class="btn">Apply</button>
 &nbsp; <a class="btn <?= $tab === 'tb' ? '' : 'sec' ?>" href="?tab=tb&to=<?= e($to) ?>">Trial Balance</a>
<a class="btn <?= $tab === 'is' ? '' : 'sec' ?>" href="?tab=is&from=<?= e($from) ?>&to=<?= e($to) ?>">Income Statement</a>
<a class="btn <?= $tab === 'bs' ? '' : 'sec' ?>" href="?tab=bs&to=<?= e($to) ?>">Balance Sheet</a>
<button type="button" class="btn sec" onclick="window.print()">Print</button></form></div>
<?php if ($tab === 'tb'): $d = 0; $c = 0; ?>
<table><tr><th>Code</th><th>Account</th><th class="r">Debit</th><th class="r">Credit</th></tr>
<?php foreach ($tot as $r): $net = $r['dr'] - $r['cr']; $x = $net > 0 ? $net : 0; $y = $net < 0 ? -$net : 0; $d += $x; $c += $y; ?>
<tr><td><?= e($r['account_code']) ?></td><td><?= e($r['account_name']) ?></td><td class="r"><?= $x ? money($x) : '' ?></td><td class="r"><?= $y ? money($y) : '' ?></td></tr><?php endforeach; ?>
<tr class="tot"><td></td><td>TOTAL</td><td class="r"><?= money($d) ?></td><td class="r"><?= money($c) ?></td></tr></table>
<p><?= abs($d - $c) < 0.005 ? '✔ Debits equal credits' : '⚠ Trial balance is out of balance' ?></p>
<?php elseif ($tab === 'is'): $ni = $sum('Revenue') - $sum('Expense'); ?>
<table><tr><th>Income Statement (<?= e($from) ?> to <?= e($to) ?>)</th><th class="r">Amount</th></tr><?= $rowsOf('Revenue') . $tr('Total revenue', $sum('Revenue')) . $rowsOf('Expense') . $tr('Total expenses', $sum('Expense')) . $tr('NET INCOME', $ni) ?></table>
<?php else: $ni = $sum('Revenue') - $sum('Expense'); $L = $sum('Liability'); $E = $sum('Equity') + $ni; $A = $sum('Asset'); ?>
<table><tr><th>Balance Sheet as of <?= e($to) ?></th><th class="r">Amount</th></tr><?= $rowsOf('Asset') . $tr('Total assets', $A) . $rowsOf('Liability') . $tr('Total liabilities', $L) . $rowsOf('Equity') ?>
<tr><td>Current period earnings (all-time)</td><td class="r"><?= money($ni) ?></td></tr><?= $tr('Total equity', $E) . $tr('Liabilities + equity', $L + $E) ?></table>
<p><?= abs($A - $L - $E) < 0.005 ? '✔ Assets = Liabilities + Equity' : '⚠ Not balanced' ?></p>
<?php endif; page_end();
