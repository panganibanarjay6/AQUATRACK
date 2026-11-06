<?php
require_once 'includes/auth.php';
require_login();

$id = $_GET['id'] ?? 0;

[$branch_clause, $branch_params] = branch_scope_clause('e');
$stmt = $pdo->prepare("SELECT e.*, d.department_name, b.branch_name FROM employees e
                        LEFT JOIN departments d ON e.department_id = d.department_id
                        LEFT JOIN branches b ON e.branch_id = b.branch_id
                        WHERE e.employee_id = ? $branch_clause");
$stmt->execute(array_merge([$id], $branch_params));
$employee = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$employee) { die("Employee not found, or not in your branch."); }

$leave_stmt = $pdo->prepare("SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY filed_at DESC LIMIT 10");
$leave_stmt->execute([$id]);
$leaves = $leave_stmt->fetchAll(PDO::FETCH_ASSOC);

$balances_stmt = $pdo->prepare("SELECT * FROM leave_balances WHERE employee_id = ?");
$balances_stmt->execute([$id]);
$balances = $balances_stmt->fetchAll(PDO::FETCH_ASSOC);

$att_stmt = $pdo->prepare("SELECT status, COUNT(*) as total FROM attendance
                            WHERE employee_id = ? AND MONTH(attendance_date) = MONTH(CURDATE())
                            GROUP BY status");
$att_stmt->execute([$id]);
$attendance_summary = $att_stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html>
<head>
    <title>Employee Profile - AquaTrack HR</title>
</head>
<body>
    <?php include 'includes/nav.php'; ?>
    <div class="content">
        <div class="profile-card">
            <h2><?= htmlspecialchars($employee['first_name'] . ' ' . $employee['last_name']) ?></h2>
            <div class="grid">
                <p><strong>Branch:</strong> <?= htmlspecialchars($employee['branch_name'] ?? '-') ?></p>
                <p><strong>Department:</strong> <?= htmlspecialchars($employee['department_name'] ?? '-') ?></p>
                <p><strong>Position:</strong> <?= htmlspecialchars($employee['position']) ?></p>
                <p><strong>Status:</strong> <?= $employee['employment_status'] ?></p>
                <p><strong>Date Hired:</strong> <?= $employee['date_hired'] ?></p>
                <p><strong>Basic Salary:</strong> <?= number_format($employee['basic_salary'], 2) ?></p>
                <p><strong>Contact:</strong> <?= htmlspecialchars($employee['contact_number']) ?></p>
                <p><strong>SSS No.:</strong> <?= htmlspecialchars($employee['sss_no']) ?></p>
                <p><strong>PhilHealth No.:</strong> <?= htmlspecialchars($employee['philhealth_no']) ?></p>
                <p><strong>Pag-IBIG No.:</strong> <?= htmlspecialchars($employee['pagibig_no']) ?></p>
            </div>

            <h3>Leave Balances</h3>
            <table>
                <tr><th>Type</th><th>Credits Remaining</th></tr>
                <?php foreach ($balances as $b): ?>
                <tr><td><?= $b['leave_type'] ?></td><td><?= $b['credits_remaining'] ?></td></tr>
                <?php endforeach; ?>
            </table>

            <h3>This Month's Attendance</h3>
            <table>
                <tr><th>Status</th><th>Count</th></tr>
                <?php foreach ($attendance_summary as $a): ?>
                <tr><td><?= $a['status'] ?></td><td><?= $a['total'] ?></td></tr>
                <?php endforeach; ?>
            </table>

            <h3>Leave History</h3>
            <table>
                <tr><th>Type</th><th>From</th><th>To</th><th>Status</th></tr>
                <?php foreach ($leaves as $l): ?>
                <tr><td><?= $l['leave_type'] ?></td><td><?= $l['date_from'] ?></td><td><?= $l['date_to'] ?></td><td><?= $l['status'] ?></td></tr>
                <?php endforeach; ?>
            </table>
        </div>
    </div>
</body>
</html>
