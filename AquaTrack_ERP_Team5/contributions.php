<?php
require_once 'includes/accounting.php';
require_role(['Admin', 'HR Staff', 'Payroll Staff']);
$can = in_array($_SESSION['role'], ['Admin', 'Payroll Staff']);
$error = ''; $ok = '';
$tab = $_REQUEST['tab'] ?? 'overview';
if (!in_array($tab, ['overview', 'sss', 'philhealth', 'pagibig', 'remittance'])) $tab = 'overview';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $can) {
    try {
        $a = $_POST['action'] ?? ''; $id = (int)($_POST['bracket_id'] ?? 0);
        if ($a === 'save_settings') {
            $st = $pdo->prepare("UPDATE contribution_settings SET setting_value = ? WHERE setting_key = ?");
            foreach (['philhealth_employee_rate', 'philhealth_floor', 'philhealth_ceiling', 'pagibig_employee_rate', 'pagibig_max_fund_salary'] as $k) {
                if (!isset($_POST[$k])) continue;
                $v = (float)$_POST[$k]; if ($v < 0) throw new Exception('Values cannot be negative.'); $st->execute([$v, $k]);
            }
            log_audit($pdo, 'UPDATE', 'contribution_settings', 0, 'PhilHealth / Pag-IBIG settings'); $ok = 'Rates saved. New payroll will use them.';
        } elseif ($a === 'delete') {
            $pdo->prepare("DELETE FROM government_contributions WHERE bracket_id = ?")->execute([$id]);
            log_audit($pdo, 'DELETE', 'government_contributions', $id, 'Deleted SSS range'); $ok = 'Salary range deleted.';
        } else {
            $min = (float)$_POST['salary_min']; $max = (float)$_POST['salary_max'];
            if ($min < 0 || $max < $min) throw new Exception('"Salary to" must be greater than or equal to "Salary from".');
            $c = $pdo->prepare("SELECT COUNT(*) FROM government_contributions WHERE bracket_id <> ? AND salary_min <= ? AND salary_max >= ?");
            $c->execute([$id, $max, $min]);
            if ($c->fetchColumn()) throw new Exception('This salary range overlaps an existing range.');
            if ($a === 'update') {
                $pdo->prepare("UPDATE government_contributions SET salary_min=?, salary_max=?, sss_amount=? WHERE bracket_id=?")->execute([$min, $max, (float)$_POST['sss'], $id]);
                log_audit($pdo, 'UPDATE', 'government_contributions', $id, "SSS range $min-$max"); $ok = 'Salary range updated.';
            } else {
                $pdo->prepare("INSERT INTO government_contributions (salary_min, salary_max, sss_amount, philhealth_amount, pagibig_amount) VALUES (?,?,?,0,0)")->execute([$min, $max, (float)$_POST['sss']]);
                log_audit($pdo, 'CREATE', 'government_contributions', $pdo->lastInsertId(), "SSS range $min-$max"); $ok = 'Salary range added.';
            }
        }
    } catch (Exception $x) { $error = $x->getMessage(); }
}

$brackets = $pdo->query("SELECT * FROM government_contributions ORDER BY salary_min")->fetchAll();
$set = [];
try { foreach ($pdo->query("SELECT setting_key, setting_value FROM contribution_settings") as $r) $set[$r['setting_key']] = (float)$r['setting_value']; }
catch (Throwable $t) { $error = $error ?: 'The contribution_settings table is missing. Run sql/04_official_contributions_2026.sql in phpMyAdmin first.'; }
$sssRate = $set['sss_rate'] ?? 5; $phRate = $set['philhealth_employee_rate'] ?? 2.5; $phFloor = $set['philhealth_floor'] ?? 10000; $phCeil = $set['philhealth_ceiling'] ?? 100000;
$hdRate = $set['pagibig_employee_rate'] ?? 2; $hdMax = $set['pagibig_max_fund_salary'] ?? 10000;
$sssMin = $brackets ? min(array_column($brackets, 'sss_amount')) : 0; $sssMax = $brackets ? max(array_column($brackets, 'sss_amount')) : 0;
$msc = fn($ee) => $sssRate > 0 ? $ee / ($sssRate / 100) : 0;

[$bc, $bp] = branch_scope_clause('e');
$q = $pdo->prepare("SELECT e.employee_id, e.first_name, e.last_name, e.basic_salary, e.sss_no, e.philhealth_no, e.pagibig_no FROM employees e
    WHERE e.archived = 0 AND e.employment_status NOT IN ('Resigned','Terminated') $bc ORDER BY e.last_name");
$q->execute($bp); $emps = $q->fetchAll();
foreach ($emps as &$e) { $e['c'] = compute_contributions($pdo, (float)$e['basic_salary']); } unset($e);
$chk = isset($_GET['salary']) && $_GET['salary'] !== '' ? (float)$_GET['salary'] : null;

// remittance (monthly, from saved payroll records)
$month = preg_match('/^\d{4}-\d{2}$/', $_GET['month'] ?? '') ? $_GET['month'] : date('Y-m');
$rem = [];
if ($tab === 'remittance') {
    $r = $pdo->prepare("SELECT e.employee_id, e.first_name, e.last_name, e.sss_no, e.philhealth_no, e.pagibig_no, SUM(p.sss_deduction) sss, SUM(p.philhealth_deduction) ph, SUM(p.pagibig_deduction) hd
        FROM payroll p JOIN employees e ON e.employee_id = p.employee_id WHERE p.period_end BETWEEN ? AND ? $bc
        GROUP BY e.employee_id, e.first_name, e.last_name, e.sss_no, e.philhealth_no, e.pagibig_no ORDER BY e.last_name");
    $r->execute(array_merge([$month . '-01', date('Y-m-t', strtotime($month . '-01'))], $bp)); $rem = $r->fetchAll();
    if (isset($_GET['export'])) {
        header('Content-Type: text/csv'); header('Content-Disposition: attachment; filename="contributions_' . $month . '.csv"');
        $o = fopen('php://output', 'w');
        fputcsv($o, ['Employee', 'SSS No', 'PhilHealth No', 'Pag-IBIG No', 'SSS employee', 'SSS employer', 'PhilHealth employee', 'PhilHealth employer', 'Pag-IBIG employee', 'Pag-IBIG employer']);
        foreach ($rem as $x) fputcsv($o, [$x['first_name'] . ' ' . $x['last_name'], $x['sss_no'], $x['philhealth_no'], $x['pagibig_no'], $x['sss'], $x['sss'] * 2, $x['ph'], $x['ph'], $x['hd'], $x['hd']]);
        fclose($o); exit;
    }
}
$idBadge = fn($v) => $v ? e($v) : '<span class="badge warn">Missing</span>';
$missing = 0; foreach ($emps as $e) if (!$e['sss_no'] || !$e['philhealth_no'] || !$e['pagibig_no']) $missing++;
$tabs = ['overview' => 'Overview', 'sss' => 'SSS', 'philhealth' => 'PhilHealth', 'pagibig' => 'Pag-IBIG', 'remittance' => 'Monthly Remittance'];
function calc_form($tab, $chk) { ?>
<form method="GET" class="form-inline"><input type="hidden" name="tab" value="<?= e($tab) ?>"><input class="num" type="number" step="0.01" min="0" name="salary" placeholder="Monthly salary, e.g. 15000" value="<?= $chk !== null ? e($chk) : '' ?>"><button class="btn">Compute</button></form>
<?php }
page_start('SSS / PhilHealth / Pag-IBIG'); msg($error, $ok); ?>
<div class="ctabs"><?php foreach ($tabs as $k => $l): ?><a class="<?= $tab === $k ? 'on' : '' ?>" href="?tab=<?= $k ?>"><?= $l ?></a><?php endforeach; ?></div>

<?php if ($tab === 'overview'): ?>
<div class="agencies">
  <a class="agency" style="--c:#0869ad" href="?tab=sss"><i class="fa-solid fa-landmark ic"></i><h3>SSS</h3><div class="pct"><?= rtrim(rtrim(number_format($sssRate, 2), '0'), '.') ?>%</div><p>of the Monthly Salary Credit (₱5,000 to ₱35,000). Employee pays ₱<?= number_format($sssMin) ?> to ₱<?= number_format($sssMax) ?> a month.</p></a>
  <a class="agency" style="--c:#16a37a" href="?tab=philhealth"><i class="fa-solid fa-heart-pulse ic"></i><h3>PhilHealth</h3><div class="pct"><?= rtrim(rtrim(number_format($phRate, 2), '0'), '.') ?>%</div><p>of monthly salary between ₱<?= number_format($phFloor) ?> and ₱<?= number_format($phCeil) ?>. Employee pays ₱<?= number_format($phFloor * $phRate / 100) ?> to ₱<?= number_format($phCeil * $phRate / 100) ?>.</p></a>
  <a class="agency" style="--c:#e08a1e" href="?tab=pagibig"><i class="fa-solid fa-house-chimney ic"></i><h3>Pag-IBIG</h3><div class="pct"><?= rtrim(rtrim(number_format($hdRate, 2), '0'), '.') ?>%</div><p>of monthly salary up to ₱<?= number_format($hdMax) ?>. Maximum ₱<?= number_format($hdMax * $hdRate / 100) ?> a month.</p></a>
</div>
<?php if ($missing): ?><div class="box"><span class="badge warn"><?= $missing ?> employee(s)</span> have no SSS, PhilHealth, or Pag-IBIG number yet. Add them in Employees so remittance reports are complete.</div><?php endif; ?>
<div class="box"><b>Check a salary</b><p class="hint">See what an employee pays to all three agencies.</p><?php calc_form('overview', $chk);
if ($chk !== null): $c = compute_contributions($pdo, $chk); ?>
<div class="result"><small>Monthly salary <?= money($chk) ?></small><div class="row"><div><small>SSS</small><b><?= money($c['sss']) ?></b></div><div><small>PhilHealth</small><b><?= money($c['ph']) ?></b></div><div><small>Pag-IBIG</small><b><?= money($c['hd']) ?></b></div>
<div><small>Total per month</small><b><?= money($c['sss'] + $c['ph'] + $c['hd']) ?></b></div><div><small>Per 15-day cutoff</small><b><?= money(($c['sss'] + $c['ph'] + $c['hd']) / 2) ?></b></div></div></div><?php endif; ?></div>
<h3>Contributions per employee</h3><p class="hint">Payroll uses these amounts. A 15-day cutoff deducts half of the monthly amount.</p>
<table><tr><th>Employee</th><th class="r">Monthly salary</th><th class="r">SSS</th><th class="r">PhilHealth</th><th class="r">Pag-IBIG</th><th class="r">Total per month</th><th class="r">Per 15-day cutoff</th></tr>
<?php foreach ($emps as $e): $c = $e['c']; $t = $c['sss'] + $c['ph'] + $c['hd']; ?><tr><td><?= e($e['first_name'] . ' ' . $e['last_name']) ?></td><td class="r"><?= money($e['basic_salary']) ?></td><td class="r"><?= money($c['sss']) ?></td><td class="r"><?= money($c['ph']) ?></td><td class="r"><?= money($c['hd']) ?></td><td class="r"><b><?= money($t) ?></b></td><td class="r"><?= money($t / 2) ?></td></tr><?php endforeach; ?>
<?php if (!$emps): ?><tr><td colspan="7">No active employees yet.</td></tr><?php endif; ?></table>

<?php elseif ($tab === 'sss'): ?>
<div class="two"><div class="box"><b>How SSS is computed</b><ol class="steps"><li>Take the employee's <b>monthly salary</b>.</li><li>Find the salary range in the SSS table. Each range has a <b>Monthly Salary Credit (MSC)</b>.</li>
<li>Employee pays <b><?= $sssRate ?>%</b> of the MSC. The employer pays <b>10%</b> of the MSC.</li></ol></div>
<div class="box"><b>Check a salary</b><p class="hint">Example: ₱15,000 falls in the ₱14,750 to ₱15,249.99 range.</p><?php calc_form('sss', $chk);
if ($chk !== null): $s = $pdo->prepare("SELECT * FROM government_contributions WHERE ? BETWEEN salary_min AND salary_max LIMIT 1"); $s->execute([$chk]); $row = $s->fetch();
if ($row): $m = $msc($row['sss_amount']); ?><div class="result"><small>Range <?= money($row['salary_min']) ?> to <?= $row['salary_max'] >= 99999999 ? 'and above' : money($row['salary_max']) ?> &middot; MSC <?= money($m) ?></small>
<div class="row"><div><small>Employee pays</small><b><?= money($row['sss_amount']) ?></b></div><div><small>Employer pays</small><b><?= money($m * 0.10) ?></b></div><div><small>Total to SSS</small><b><?= money($row['sss_amount'] + $m * 0.10) ?></b></div></div></div>
<?php else: ?><p class="neg">No SSS range covers this salary. Add one under "Edit the SSS table".</p><?php endif; endif; ?></div></div>
<h3>SSS per employee</h3>
<table><tr><th>Employee</th><th>SSS No.</th><th class="r">Monthly salary</th><th class="r">Salary credit (MSC)</th><th class="r">Employee pays</th><th class="r">Employer pays</th></tr>
<?php $te = 0; $tr = 0; foreach ($emps as $e): $ee = $e['c']['sss']; $m = $msc($ee); $te += $ee; $tr += $m * 0.10; ?><tr><td><?= e($e['first_name'] . ' ' . $e['last_name']) ?></td><td><?= $idBadge($e['sss_no']) ?></td><td class="r"><?= money($e['basic_salary']) ?></td><td class="r"><?= money($m) ?></td><td class="r"><?= money($ee) ?></td><td class="r"><?= money($m * 0.10) ?></td></tr><?php endforeach; ?>
<tr class="tot"><td colspan="4">TOTAL PER MONTH</td><td class="r"><?= money($te) ?></td><td class="r"><?= money($tr) ?></td></tr></table>
<details class="box" style="margin-top:18px"><summary>View the SSS table (<?= count($brackets) ?> salary ranges)</summary><table><tr><th>Monthly salary range</th><th class="r">Salary credit (MSC)</th><th class="r">Employee pays</th></tr>
<?php foreach ($brackets as $b): ?><tr><td><?= $b['salary_min'] <= 0 ? 'Below ' . money($b['salary_max'] + 0.01) : ($b['salary_max'] >= 99999999 ? money($b['salary_min']) . ' and above' : money($b['salary_min']) . ' to ' . money($b['salary_max'])) ?></td><td class="r"><?= money($msc($b['sss_amount'])) ?></td><td class="r"><?= money($b['sss_amount']) ?></td></tr><?php endforeach; ?></table></details>
<?php if ($can): ?><details class="box"><summary>Edit the SSS table (advanced)</summary>
<form method="POST"><input type="hidden" name="tab" value="sss"><input type="hidden" name="action" value="add"><b>Add a salary range</b><div class="fgrid">
<div><label>Salary from (₱)</label><input type="number" step="0.01" min="0" name="salary_min" required></div><div><label>Salary to (₱)</label><input type="number" step="0.01" min="0" name="salary_max" required></div>
<div><label>Employee pays (₱)</label><input type="number" step="0.01" min="0" name="sss" required></div><div><button class="btn">Add range</button></div></div></form>
<table><tr><th>Salary from</th><th>Salary to</th><th>Employee pays</th><th>Action</th></tr><?php foreach ($brackets as $b): $fm = 'f' . $b['bracket_id']; ?><tr>
<td><input form="<?= $fm ?>" class="num" type="number" step="0.01" name="salary_min" value="<?= $b['salary_min'] ?>"></td><td><input form="<?= $fm ?>" class="num" type="number" step="0.01" name="salary_max" value="<?= $b['salary_max'] ?>"></td><td><input form="<?= $fm ?>" class="num" type="number" step="0.01" name="sss" value="<?= $b['sss_amount'] ?>"></td>
<td><form id="<?= $fm ?>" method="POST" style="margin:0"><input type="hidden" name="tab" value="sss"><input type="hidden" name="bracket_id" value="<?= $b['bracket_id'] ?>"><button class="btn" name="action" value="update">Save</button> <button class="btn danger" name="action" value="delete" onclick="return confirm('Delete this salary range?')">Delete</button></form></td></tr><?php endforeach; ?></table></details><?php endif; ?>

<?php elseif ($tab === 'philhealth' || $tab === 'pagibig'): $ph = $tab === 'philhealth'; $rate = $ph ? $phRate : $hdRate; ?>
<div class="two"><div class="box"><b>How <?= $ph ? 'PhilHealth' : 'Pag-IBIG' ?> is computed</b><ol class="steps">
<?php if ($ph): ?><li>Take the <b>monthly salary</b>. If it is below ₱<?= number_format($phFloor) ?>, use ₱<?= number_format($phFloor) ?>. If it is above ₱<?= number_format($phCeil) ?>, use ₱<?= number_format($phCeil) ?>.</li>
<li>Employee pays <b><?= $phRate ?>%</b> of that amount. The employer pays the same, so the total premium is <?= $phRate * 2 ?>%.</li>
<?php else: ?><li>Take the <b>monthly salary</b>. If it is above ₱<?= number_format($hdMax) ?>, use ₱<?= number_format($hdMax) ?>.</li>
<li>Employee pays <b><?= $hdRate ?>%</b> of that amount, which is at most ₱<?= number_format($hdMax * $hdRate / 100) ?>. The employer pays the same.</li><?php endif; ?></ol></div>
<div class="box"><b>Check a salary</b><p class="hint">Type any monthly salary to see the result.</p><?php calc_form($tab, $chk);
if ($chk !== null): $c = compute_contributions($pdo, $chk); $base = $ph ? min(max($chk, $phFloor), $phCeil) : min($chk, $hdMax); $ee = $ph ? $c['ph'] : $c['hd']; ?>
<div class="result"><small>Salary used: <?= money($base) ?></small><div class="row"><div><small>Employee pays</small><b><?= money($ee) ?></b></div><div><small>Employer pays</small><b><?= money($ee) ?></b></div><div><small>Total</small><b><?= money($ee * 2) ?></b></div></div></div><?php endif; ?></div></div>
<h3><?= $ph ? 'PhilHealth' : 'Pag-IBIG' ?> per employee</h3>
<table><tr><th>Employee</th><th><?= $ph ? 'PhilHealth' : 'Pag-IBIG' ?> No.</th><th class="r">Monthly salary</th><th class="r">Salary used</th><th class="r">Employee pays</th><th class="r">Employer pays</th></tr>
<?php $te = 0; foreach ($emps as $e): $base = $ph ? min(max($e['basic_salary'], $phFloor), $phCeil) : min($e['basic_salary'], $hdMax); $ee = $ph ? $e['c']['ph'] : $e['c']['hd']; $te += $ee; ?>
<tr><td><?= e($e['first_name'] . ' ' . $e['last_name']) ?></td><td><?= $idBadge($ph ? $e['philhealth_no'] : $e['pagibig_no']) ?></td><td class="r"><?= money($e['basic_salary']) ?></td><td class="r"><?= money($base) ?></td><td class="r"><?= money($ee) ?></td><td class="r"><?= money($ee) ?></td></tr><?php endforeach; ?>
<tr class="tot"><td colspan="4">TOTAL PER MONTH</td><td class="r"><?= money($te) ?></td><td class="r"><?= money($te) ?></td></tr></table>
<?php if ($can): ?><details class="box" style="margin-top:18px"><summary>Change the <?= $ph ? 'PhilHealth' : 'Pag-IBIG' ?> rates</summary>
<form method="POST"><input type="hidden" name="tab" value="<?= $tab ?>"><input type="hidden" name="action" value="save_settings"><div class="fgrid">
<?php if ($ph): ?><div><label>Employee share (%)</label><input type="number" step="0.01" name="philhealth_employee_rate" value="<?= $phRate ?>"></div><div><label>Minimum salary (₱)</label><input type="number" step="0.01" name="philhealth_floor" value="<?= $phFloor ?>"></div><div><label>Maximum salary (₱)</label><input type="number" step="0.01" name="philhealth_ceiling" value="<?= $phCeil ?>"></div>
<?php else: ?><div><label>Employee share (%)</label><input type="number" step="0.01" name="pagibig_employee_rate" value="<?= $hdRate ?>"></div><div><label>Maximum salary used (₱)</label><input type="number" step="0.01" name="pagibig_max_fund_salary" value="<?= $hdMax ?>"></div><?php endif; ?>
<div><button class="btn">Save rates</button></div></div></form></details><?php endif; ?>

<?php else: ?>
<div class="box"><form method="GET" class="form-inline"><input type="hidden" name="tab" value="remittance"><b>Month</b> <input type="month" name="month" value="<?= e($month) ?>"><button class="btn">Show</button>
<a class="btn sec" href="?tab=remittance&month=<?= e($month) ?>&export=1">Export CSV</a><button type="button" class="btn sec" onclick="window.print()">Print</button></form>
<p class="hint">Built from saved payroll records whose period ends in this month. Employer share is estimated: SSS employer is 10% of the MSC (double the employee share), and PhilHealth and Pag-IBIG employer shares equal the employee share. SSS EC contribution is not included.</p></div>
<?php $T = ['sss' => 0, 'ph' => 0, 'hd' => 0]; foreach ($rem as $x) { $T['sss'] += $x['sss']; $T['ph'] += $x['ph']; $T['hd'] += $x['hd']; } ?>
<table><tr><th>Agency</th><th class="r">Employee share</th><th class="r">Employer share</th><th class="r">Total to remit</th></tr>
<tr><td>SSS</td><td class="r"><?= money($T['sss']) ?></td><td class="r"><?= money($T['sss'] * 2) ?></td><td class="r"><b><?= money($T['sss'] * 3) ?></b></td></tr>
<tr><td>PhilHealth</td><td class="r"><?= money($T['ph']) ?></td><td class="r"><?= money($T['ph']) ?></td><td class="r"><b><?= money($T['ph'] * 2) ?></b></td></tr>
<tr><td>Pag-IBIG</td><td class="r"><?= money($T['hd']) ?></td><td class="r"><?= money($T['hd']) ?></td><td class="r"><b><?= money($T['hd'] * 2) ?></b></td></tr>
<tr class="tot"><td>TOTAL</td><td class="r"><?= money($T['sss'] + $T['ph'] + $T['hd']) ?></td><td class="r"><?= money($T['sss'] * 2 + $T['ph'] + $T['hd']) ?></td><td class="r"><?= money($T['sss'] * 3 + $T['ph'] * 2 + $T['hd'] * 2) ?></td></tr></table>
<h3>Per employee (employee share)</h3>
<table><tr><th>Employee</th><th>SSS No.</th><th>PhilHealth No.</th><th>Pag-IBIG No.</th><th class="r">SSS</th><th class="r">PhilHealth</th><th class="r">Pag-IBIG</th></tr>
<?php foreach ($rem as $x): ?><tr><td><?= e($x['first_name'] . ' ' . $x['last_name']) ?></td><td><?= $idBadge($x['sss_no']) ?></td><td><?= $idBadge($x['philhealth_no']) ?></td><td><?= $idBadge($x['pagibig_no']) ?></td><td class="r"><?= money($x['sss']) ?></td><td class="r"><?= money($x['ph']) ?></td><td class="r"><?= money($x['hd']) ?></td></tr><?php endforeach; ?>
<?php if (!$rem): ?><tr><td colspan="7">No payroll records for this month. Generate payroll first.</td></tr><?php endif; ?></table>
<?php endif; page_end();
