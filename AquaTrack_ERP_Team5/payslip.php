<?php
require_once 'includes/auth.php';
require_role(['Admin', 'HR Staff', 'Payroll Staff']);
[$bc, $bp] = branch_scope_clause('e');
$st = $pdo->prepare("SELECT p.*, e.first_name, e.last_name, e.position, b.branch_name FROM payroll p JOIN employees e ON e.employee_id = p.employee_id
    LEFT JOIN branches b ON b.branch_id = e.branch_id WHERE p.payroll_id = ? $bc");
$st->execute(array_merge([(int)($_GET['id'] ?? 0)], $bp)); $p = $st->fetch();
if (!$p) { http_response_code(404); die('Payslip not found.'); }
$m = fn($n) => '₱' . number_format((float)$n, 2);
$ded = $p['absence_deduction'] + $p['late_deduction'] + $p['sss_deduction'] + $p['philhealth_deduction'] + $p['pagibig_deduction'];
?><!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payslip #<?= $p['payroll_id'] ?></title>
<style>body{font-family:Arial,sans-serif;max-width:560px;margin:30px auto;color:#17324d}h2{color:#0869ad;margin:0}table{width:100%;border-collapse:collapse;margin:12px 0}td{padding:7px 4px;border-bottom:1px solid #e2e8f0}td:last-child{text-align:right}
.tot td{font-weight:bold;border-top:2px solid #17324d}.sig{display:flex;justify-content:space-between;margin-top:50px;font-size:12px}.sig div{border-top:1px solid #17324d;padding-top:4px;width:40%;text-align:center}button{padding:8px 16px;background:#0869ad;color:#fff;border:0;border-radius:6px;cursor:pointer}@media print{button{display:none}}</style></head><body>
<h2>AquaTrack</h2><div>Payslip &middot; <?= htmlspecialchars($p['period_start']) ?> to <?= htmlspecialchars($p['period_end']) ?></div>
<p><b><?= htmlspecialchars($p['first_name'] . ' ' . $p['last_name']) ?></b><br><?= htmlspecialchars($p['position'] ?? '') ?> &middot; <?= htmlspecialchars($p['branch_name'] ?? '') ?></p>
<table><tr><td colspan="2"><b>Earnings</b></td></tr><tr><td>Basic pay</td><td><?= $m($p['basic_salary']) ?></td></tr><tr><td>Overtime pay</td><td><?= $m($p['overtime_pay']) ?></td></tr>
<tr><td colspan="2"><b>Deductions</b></td></tr><tr><td>Absences</td><td><?= $m($p['absence_deduction']) ?></td></tr><tr><td>Late</td><td><?= $m($p['late_deduction']) ?></td></tr>
<tr><td>SSS</td><td><?= $m($p['sss_deduction']) ?></td></tr><tr><td>PhilHealth</td><td><?= $m($p['philhealth_deduction']) ?></td></tr><tr><td>Pag-IBIG</td><td><?= $m($p['pagibig_deduction']) ?></td></tr>
<tr><td>Total deductions</td><td><?= $m($ded) ?></td></tr><tr class="tot"><td>NET PAY</td><td><?= $m($p['net_salary']) ?></td></tr></table>
<div class="sig"><div>Prepared by</div><div>Received by</div></div><p><button onclick="window.print()">Print</button></p></body></html>
