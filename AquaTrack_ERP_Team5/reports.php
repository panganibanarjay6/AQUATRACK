<?php
require_once 'includes/auth.php';
require_role(['Admin', 'HR Staff', 'Payroll Staff']);

[$branch_clause, $branch_params] = branch_scope_clause('e');

$headcount = $pdo->prepare("SELECT d.department_name, COUNT(*) as total FROM employees e
                             JOIN departments d ON e.department_id = d.department_id
                             WHERE e.archived = 0 $branch_clause GROUP BY d.department_name");
$headcount->execute($branch_params);
$headcount = $headcount->fetchAll(PDO::FETCH_ASSOC);

// Headcount by branch - only meaningful for Admin/Payroll Staff (not branch-locked)
$headcount_by_branch = [];
if (!is_branch_locked()) {
    $headcount_by_branch = $pdo->query("SELECT b.branch_name, COUNT(*) as total FROM employees e
                                         JOIN branches b ON e.branch_id = b.branch_id
                                         WHERE e.archived = 0 GROUP BY b.branch_name")->fetchAll(PDO::FETCH_ASSOC);
}

$month = $_GET['month'] ?? date('Y-m');
$attendance_summary = $pdo->prepare("SELECT status, COUNT(*) as total FROM attendance a
                                      JOIN employees e ON a.employee_id = e.employee_id
                                      WHERE DATE_FORMAT(a.attendance_date, '%Y-%m') = ? $branch_clause GROUP BY status");
$attendance_summary->execute(array_merge([$month], $branch_params));
$attendance_summary = $attendance_summary->fetchAll(PDO::FETCH_ASSOC);

$payroll_summary = $pdo->prepare("SELECT SUM(p.net_salary) as total_net, SUM(p.sss_deduction) as total_sss,
                                   SUM(p.philhealth_deduction) as total_ph, SUM(p.pagibig_deduction) as total_pi
                                   FROM payroll p JOIN employees e ON p.employee_id = e.employee_id
                                   WHERE DATE_FORMAT(p.period_start, '%Y-%m') = ? $branch_clause");
$payroll_summary->execute(array_merge([$month], $branch_params));
$payroll_summary = $payroll_summary->fetch(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html>
<head>
    <title>HR Reports - AquaTrack HR</title>
</head>
<body>
    <?php include 'includes/nav.php'; ?>
    <div class="content">
        <h2>HR Reports</h2>
        <p><a class="btn" href="payroll_reports.php">Payroll Reports (register, remittances, CSV)</a></p>

        <form method="GET">
            <label>Month:</label>
            <input type="month" name="month" value="<?= htmlspecialchars($month) ?>">
            <button class="btn" type="submit">View</button>
        </form>

        <?php if ($headcount_by_branch): ?>
        <h3>Headcount by Branch</h3>
        <table>
            <tr><th>Branch</th><th>Employees</th></tr>
            <?php foreach ($headcount_by_branch as $h): ?>
            <tr><td><?= htmlspecialchars($h['branch_name']) ?></td><td><?= $h['total'] ?></td></tr>
            <?php endforeach; ?>
        </table>
        <?php endif; ?>

        <h3>Headcount by Department</h3>
        <table>
            <tr><th>Department</th><th>Employees</th></tr>
            <?php foreach ($headcount as $h): ?>
            <tr><td><?= htmlspecialchars($h['department_name']) ?></td><td><?= $h['total'] ?></td></tr>
            <?php endforeach; ?>
        </table>

        <h3>Attendance Summary - <?= htmlspecialchars($month) ?></h3>
        <table>
            <tr><th>Status</th><th>Count</th></tr>
            <?php foreach ($attendance_summary as $a): ?>
            <tr><td><?= $a['status'] ?></td><td><?= $a['total'] ?></td></tr>
            <?php endforeach; ?>
        </table>

        <h3>Payroll Summary - <?= htmlspecialchars($month) ?></h3>
        <table>
            <tr><th>Total Net Salary Paid</th><th>Total SSS</th><th>Total PhilHealth</th><th>Total Pag-IBIG</th></tr>
            <tr>
                <td><?= number_format($payroll_summary['total_net'] ?? 0, 2) ?></td>
                <td><?= number_format($payroll_summary['total_sss'] ?? 0, 2) ?></td>
                <td><?= number_format($payroll_summary['total_ph'] ?? 0, 2) ?></td>
                <td><?= number_format($payroll_summary['total_pi'] ?? 0, 2) ?></td>
            </tr>
        </table>
    </div>
</body>
</html>
