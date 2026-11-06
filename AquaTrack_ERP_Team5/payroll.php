<?php
require_once 'includes/accounting.php';
require_role(['Admin', 'Payroll Staff']);

$daily_rate_divisor = 26; // working days/month, adjust as needed
$overtime_rate_multiplier = 1.25;

// Computes and stores payroll for a single employee row; returns the net salary.
function generate_payroll_for_employee($pdo, $employee, $period_start, $period_end, $daily_rate_divisor, $overtime_rate_multiplier) {
    $employee_id = $employee['employee_id'];
    $daily_rate = $employee['basic_salary'] / $daily_rate_divisor;
    $hourly_rate = $daily_rate / 8;

    // Skip if payroll for this employee + period already exists (prevents double payment)
    $dup = $pdo->prepare("SELECT 1 FROM payroll WHERE employee_id = ? AND period_start = ? AND period_end = ?");
    $dup->execute([$employee_id, $period_start, $period_end]);
    if ($dup->fetch()) return null;

    // basic_salary is MONTHLY. A cutoff of 16 days or less (semi-monthly) pays half of it.
    $days_in_period = (strtotime($period_end) - strtotime($period_start)) / 86400 + 1;
    $factor = $days_in_period <= 16 ? 0.5 : 1;
    $period_basic = round($employee['basic_salary'] * $factor, 2);

    $att = $pdo->prepare("SELECT status, SUM(overtime_hours) as ot_hours, COUNT(*) as day_count
                           FROM attendance WHERE employee_id = ? AND attendance_date BETWEEN ? AND ?
                           GROUP BY status");
    $att->execute([$employee_id, $period_start, $period_end]);
    $rows = $att->fetchAll(PDO::FETCH_ASSOC);

    $absent_days = 0; $late_count = 0; $total_ot_hours = 0;
    foreach ($rows as $r) {
        if ($r['status'] === 'Absent') $absent_days += $r['day_count'];
        if ($r['status'] === 'Half-Day') $absent_days += 0.5 * $r['day_count'];
        if ($r['status'] === 'Late') $late_count = $r['day_count'];
        $total_ot_hours += $r['ot_hours'] ?? 0;
    }

    $absence_deduction = round($absent_days * $daily_rate, 2);
    $late_deduction = round($late_count * ($hourly_rate * 0.5), 2);
    $overtime_pay = round($total_ot_hours * $hourly_rate * $overtime_rate_multiplier, 2);

    $gc = compute_contributions($pdo, (float)$employee['basic_salary']);
    $sss = $gc['sss'] * $factor;
    $philhealth = $gc['ph'] * $factor;
    $pagibig = $gc['hd'] * $factor;

    $net_salary = $period_basic + $overtime_pay - $absence_deduction - $late_deduction
                  - $sss - $philhealth - $pagibig;

    $insert = $pdo->prepare("INSERT INTO payroll
        (employee_id, period_start, period_end, basic_salary, overtime_pay, absence_deduction,
         late_deduction, sss_deduction, philhealth_deduction, pagibig_deduction, net_salary)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)");
    $insert->execute([
        $employee_id, $period_start, $period_end, $period_basic, $overtime_pay,
        $absence_deduction, $late_deduction, $sss, $philhealth, $pagibig, $net_salary
    ]);
    $payroll_id = $pdo->lastInsertId();
    log_audit($pdo, 'CREATE', 'payroll', $payroll_id, "Generated payroll, net: $net_salary");

    // Posting to accounting is now a separate, explicit step (see 'Post to Accounting' below).

    return $net_salary;
}

// POST TO ACCOUNTING - one record or all unposted records
$post_msg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && (isset($_POST['post_payroll']) || isset($_POST['post_all']))) {
    try {
        $ids = isset($_POST['post_all']) ? $pdo->query("SELECT payroll_id FROM payroll WHERE posted_to_accounting = 0")->fetchAll(PDO::FETCH_COLUMN) : [(int)$_POST['payroll_id']];
        $n = 0; foreach ($ids as $id) if (post_payroll_to_accounting($pdo, (int)$id)) $n++;
        $post_msg = "$n payroll record(s) posted to accounting.";
    } catch (Exception $ex) { $post_msg = 'Error: ' . $ex->getMessage(); }
}

// GENERATE PAYROLL - single employee, one branch, or all branches
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['generate_payroll'])) {
    $period_start = $_POST['period_start'];
    $period_end = $_POST['period_end'];
    $scope = $_POST['scope']; // 'employee' | 'branch' | 'all'

    if ($scope === 'employee') {
        $emp = $pdo->prepare("SELECT * FROM employees WHERE employee_id = ? AND archived = 0");
        $emp->execute([$_POST['employee_id']]);
        $targets = $emp->fetchAll(PDO::FETCH_ASSOC);
    } elseif ($scope === 'branch') {
        $emp = $pdo->prepare("SELECT * FROM employees WHERE branch_id = ? AND archived = 0 AND employment_status NOT IN ('Resigned','Terminated')");
        $emp->execute([$_POST['branch_id']]);
        $targets = $emp->fetchAll(PDO::FETCH_ASSOC);
    } else { // 'all' - company-wide (Admin/Payroll Staff only, already enforced by require_role)
        $targets = $pdo->query("SELECT * FROM employees WHERE archived = 0 AND employment_status NOT IN ('Resigned','Terminated')")->fetchAll(PDO::FETCH_ASSOC);
    }

    foreach ($targets as $employee) {
        generate_payroll_for_employee($pdo, $employee, $period_start, $period_end, $daily_rate_divisor, $overtime_rate_multiplier);
    }

    header("Location: payroll.php");
    exit;
}

[$branch_clause, $branch_params] = branch_scope_clause('e');

$emp_stmt = $pdo->prepare("SELECT employee_id, first_name, last_name FROM employees e
                            WHERE archived = 0 AND employment_status NOT IN ('Resigned','Terminated') $branch_clause");
$emp_stmt->execute($branch_params);
$employees = $emp_stmt->fetchAll(PDO::FETCH_ASSOC);

$branches = $pdo->query("SELECT * FROM branches ORDER BY branch_id")->fetchAll(PDO::FETCH_ASSOC);

$pr_stmt = $pdo->prepare("SELECT p.*, e.first_name, e.last_name, b.branch_name FROM payroll p
                           JOIN employees e ON p.employee_id = e.employee_id
                           LEFT JOIN branches b ON e.branch_id = b.branch_id
                           WHERE 1=1 $branch_clause ORDER BY p.generated_at DESC LIMIT 30");
$pr_stmt->execute($branch_params);
$payroll_records = $pr_stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html>
<head>
    <title>Payroll - AquaTrack HR</title>
</head>
<body>
    <?php include 'includes/nav.php'; ?>
    <div class="content">
        <h2>Payroll</h2>

        <div class="form-box">
            <h3>Generate Payroll</h3>
            <form method="POST" id="payrollForm">
                <div class="scope-group">
                    <label><input type="radio" name="scope" value="employee" checked onclick="toggleScope()"> Single Employee</label><br>
                    <?php if (!is_branch_locked()): ?>
                    <label><input type="radio" name="scope" value="branch" onclick="toggleScope()"> Whole Branch</label><br>
                    <label><input type="radio" name="scope" value="all" onclick="toggleScope()"> All Branches (Company-wide)</label>
                    <?php else: ?>
                    <label><input type="radio" name="scope" value="branch" onclick="toggleScope()"> My Whole Branch</label>
                    <?php endif; ?>
                </div>

                <div id="employeeField">
                    <select name="employee_id">
                        <option value="">-- Select Employee --</option>
                        <?php foreach ($employees as $e): ?>
                            <option value="<?= $e['employee_id'] ?>"><?= htmlspecialchars($e['first_name'] . ' ' . $e['last_name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div id="branchField" style="display:none;">
                    <?php if (!is_branch_locked()): ?>
                    <select name="branch_id">
                        <option value="">-- Select Branch --</option>
                        <?php foreach ($branches as $b): ?>
                            <option value="<?= $b['branch_id'] ?>"><?= htmlspecialchars($b['branch_name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <?php else: ?>
                    <input type="hidden" name="branch_id" value="<?= current_branch_id() ?>">
                    <?php endif; ?>
                </div>

                <label>Period Start:</label>
                <input type="date" name="period_start" required>
                <label>Period End:</label>
                <input type="date" name="period_end" required>
                <button class="btn" type="submit" name="generate_payroll"
                        onclick="return confirm('Generate payroll for the selected scope? This cannot be undone.')">
                    Generate Payroll
                </button>
            </form>
        </div>

        <?php if ($post_msg): ?><p><strong><?= htmlspecialchars($post_msg) ?></strong></p><?php endif; ?>
        <h3>Payroll Records</h3>
        <form method="POST"><button class="btn" name="post_all" type="submit" onclick="return confirm('Post ALL unposted payroll to accounting?')">Post All Unposted to Accounting</button></form>
        <table>
            <tr>
                <th>Employee</th><th>Branch</th><th>Period</th><th>Basic</th><th>OT Pay</th><th>Absence Ded.</th>
                <th>Late Ded.</th><th>SSS</th><th>PhilHealth</th><th>Pag-IBIG</th><th>Net Salary</th><th>Payslip</th><th>Accounting</th>
            </tr>
            <?php foreach ($payroll_records as $p): ?>
            <tr>
                <td><?= htmlspecialchars($p['first_name'] . ' ' . $p['last_name']) ?></td>
                <td><?= htmlspecialchars($p['branch_name'] ?? '-') ?></td>
                <td><?= $p['period_start'] ?> to <?= $p['period_end'] ?></td>
                <td><?= number_format($p['basic_salary'], 2) ?></td>
                <td><?= number_format($p['overtime_pay'], 2) ?></td>
                <td><?= number_format($p['absence_deduction'], 2) ?></td>
                <td><?= number_format($p['late_deduction'], 2) ?></td>
                <td><?= number_format($p['sss_deduction'], 2) ?></td>
                <td><?= number_format($p['philhealth_deduction'], 2) ?></td>
                <td><?= number_format($p['pagibig_deduction'], 2) ?></td>
                <td><strong><?= number_format($p['net_salary'], 2) ?></strong></td>
                <td><a class="btn sec" href="payslip.php?id=<?= $p['payroll_id'] ?>" target="_blank">Payslip</a></td>
                <td><?php if ($p['posted_to_accounting']): ?>Posted (JE #<?= $p['journal_id'] ?>)<?php else: ?>
                    <form method="POST" style="margin:0"><input type="hidden" name="payroll_id" value="<?= $p['payroll_id'] ?>">
                    <button class="btn" name="post_payroll" type="submit">Post to Accounting</button></form><?php endif; ?></td>
            </tr>
            <?php endforeach; ?>
        </table>
    </div>

    <script>
        function toggleScope() {
            const scope = document.querySelector('input[name="scope"]:checked').value;
            document.getElementById('employeeField').style.display = (scope === 'employee') ? 'block' : 'none';
            document.getElementById('branchField').style.display = (scope === 'branch') ? 'block' : 'none';
        }
    </script>
</body>
</html>
