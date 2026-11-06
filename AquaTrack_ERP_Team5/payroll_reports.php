<?php
require_once 'includes/accounting.php';
require_role(['Admin', 'HR Staff', 'Payroll Staff']);
[$bc, $bp] = branch_scope_clause('e');
$from = $_GET['from'] ?? date('Y-m-01'); $to = $_GET['to'] ?? date('Y-m-t'); $branch = (int)($_GET['branch'] ?? 0);
$where = "p.period_start >= ? AND p.period_end <= ? $bc"; $params = array_merge([$from, $to], $bp);
if ($branch && !is_branch_locked()) { $where .= " AND e.branch_id = ?"; $params[] = $branch; }
$st = $pdo->prepare("SELECT p.*, e.first_name, e.last_name, e.position, b.branch_name FROM payroll p JOIN employees e ON e.employee_id = p.employee_id
    LEFT JOIN branches b ON b.branch_id = e.branch_id WHERE $where ORDER BY b.branch_id, e.last_name, p.period_start");
$st->execute($params); $rows = $st->fetchAll();
if (isset($_GET['export'])) {
    header('Content-Type: text/csv'); header('Content-Disposition: attachment; filename="payroll_report_' . $from . '_to_' . $to . '.csv"');
    $o = fopen('php://output', 'w');
    fputcsv($o, ['Employee', 'Branch', 'Period start', 'Period end', 'Basic', 'Overtime', 'Absence ded.', 'Late ded.', 'SSS', 'PhilHealth', 'Pag-IBIG', 'Net pay']);
    foreach ($rows as $r) fputcsv($o, [$r['first_name'] . ' ' . $r['last_name'], $r['branch_name'], $r['period_start'], $r['period_end'], $r['basic_salary'], $r['overtime_pay'], $r['absence_deduction'], $r['late_deduction'], $r['sss_deduction'], $r['philhealth_deduction'], $r['pagibig_deduction'], $r['net_salary']]);
    fclose($o); exit;
}
$T = ['gross' => 0, 'ded' => 0, 'net' => 0, 'sss' => 0, 'ph' => 0, 'hd' => 0]; $byb = [];
foreach ($rows as $r) {
    $g = $r['basic_salary'] + $r['overtime_pay']; $d = $r['absence_deduction'] + $r['late_deduction'] + $r['sss_deduction'] + $r['philhealth_deduction'] + $r['pagibig_deduction'];
    $T['gross'] += $g; $T['ded'] += $d; $T['net'] += $r['net_salary']; $T['sss'] += $r['sss_deduction']; $T['ph'] += $r['philhealth_deduction']; $T['hd'] += $r['pagibig_deduction'];
    $k = $r['branch_name'] ?? '-'; $byb[$k] = ($byb[$k] ?? 0) + $r['net_salary'];
}
$branches = $pdo->query("SELECT * FROM branches ORDER BY branch_id")->fetchAll();
page_start('Payroll Reports'); ?>
<div class="box noprint"><form method="GET">From <input type="date" name="from" value="<?= e($from) ?>"> To <input type="date" name="to" value="<?= e($to) ?>">
<?php if (!is_branch_locked()): ?>Branch <select name="branch"><option value="0">All branches</option><?php foreach ($branches as $b): ?><option value="<?= $b['branch_id'] ?>" <?= $branch === (int)$b['branch_id'] ? 'selected' : '' ?>><?= e($b['branch_name']) ?></option><?php endforeach; ?></select><?php endif; ?>
<button class="btn">Apply</button> <a class="btn sec" href="?from=<?= e($from) ?>&to=<?= e($to) ?>&branch=<?= $branch ?>&export=1">Export CSV</a> <button type="button" class="btn sec" onclick="window.print()">Print</button></form></div>
<div class="stats"><div class="stat"><small>GROSS PAY</small><b><?= money($T['gross']) ?></b><i><?= count($rows) ?> payroll record(s)</i></div><div class="stat"><small>TOTAL DEDUCTIONS</small><b><?= money($T['ded']) ?></b></div><div class="stat"><small>NET PAY</small><b><?= money($T['net']) ?></b></div>
<div class="stat"><small>FOR REMITTANCE</small><b><?= money($T['sss'] + $T['ph'] + $T['hd']) ?></b><i>SSS + PhilHealth + Pag-IBIG</i></div></div>
<h3>Payroll register (<?= e($from) ?> to <?= e($to) ?>)</h3>
<table><tr><th>Employee</th><th>Branch</th><th>Period</th><th class="r">Basic</th><th class="r">OT</th><th class="r">Absence</th><th class="r">Late</th><th class="r">SSS</th><th class="r">PhilHealth</th><th class="r">Pag-IBIG</th><th class="r">Net pay</th></tr>
<?php foreach ($rows as $r): ?><tr><td><?= e($r['first_name'] . ' ' . $r['last_name']) ?></td><td><?= e($r['branch_name']) ?></td><td><?= e($r['period_start']) ?> to <?= e($r['period_end']) ?></td>
<td class="r"><?= money($r['basic_salary']) ?></td><td class="r"><?= money($r['overtime_pay']) ?></td><td class="r"><?= money($r['absence_deduction']) ?></td><td class="r"><?= money($r['late_deduction']) ?></td>
<td class="r"><?= money($r['sss_deduction']) ?></td><td class="r"><?= money($r['philhealth_deduction']) ?></td><td class="r"><?= money($r['pagibig_deduction']) ?></td><td class="r"><b><?= money($r['net_salary']) ?></b></td></tr><?php endforeach; ?>
<?php if (!$rows): ?><tr><td colspan="11">No payroll records in this period.</td></tr><?php endif; ?>
<tr class="tot"><td colspan="7">TOTAL</td><td class="r"><?= money($T['sss']) ?></td><td class="r"><?= money($T['ph']) ?></td><td class="r"><?= money($T['hd']) ?></td><td class="r"><?= money($T['net']) ?></td></tr></table>
<h3>Net pay per branch</h3>
<table><tr><th>Branch</th><th class="r">Net pay</th></tr><?php foreach ($byb as $k => $v): ?><tr><td><?= e($k) ?></td><td class="r"><?= money($v) ?></td></tr><?php endforeach; ?><?php if (!$byb): ?><tr><td colspan="2">No data.</td></tr><?php endif; ?></table>
<?php page_end();
