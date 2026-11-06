<?php
require_once 'includes/accounting.php';
require_login();

[$branch_clause, $branch_params] = branch_scope_clause('e');

$total_employees = $pdo->prepare("SELECT COUNT(*) FROM employees e WHERE e.archived = 0 $branch_clause");
$total_employees->execute($branch_params);
$total_employees = $total_employees->fetchColumn();

$present_today = $pdo->prepare("SELECT COUNT(*) FROM attendance a JOIN employees e ON a.employee_id = e.employee_id
                                 WHERE a.attendance_date = ? AND a.status IN ('Present','Late') $branch_clause");
$present_today->execute(array_merge([date('Y-m-d')], $branch_params));
$present_today = $present_today->fetchColumn();

$absent_today = $pdo->prepare("SELECT COUNT(*) FROM attendance a JOIN employees e ON a.employee_id = e.employee_id
                                WHERE a.attendance_date = ? AND a.status = 'Absent' $branch_clause");
$absent_today->execute(array_merge([date('Y-m-d')], $branch_params));
$absent_today = $absent_today->fetchColumn();

$pending_leaves = $pdo->prepare("SELECT COUNT(*) FROM leave_requests l JOIN employees e ON l.employee_id = e.employee_id
                                  WHERE l.status = 'Pending' $branch_clause");
$pending_leaves->execute($branch_params);
$pending_leaves = $pending_leaves->fetchColumn();
$role = $_SESSION['role'];
$is_acc = in_array($role, ACC_ROLES);
$cash = $ni = $ap = $ar = $payroll_month = 0;
if ($is_acc) {
    foreach (account_totals($pdo, null, date('Y-m-d')) as $t) {
        if (in_array($t['account_code'], ['1000', '1010'])) $cash += $t['dr'] - $t['cr'];
        if ($t['account_type'] === 'Revenue') $ni += $t['cr'] - $t['dr'];
        if ($t['account_type'] === 'Expense') $ni -= $t['dr'] - $t['cr'];
    }
    $ap = $pdo->query("SELECT COALESCE(SUM(amount),0) FROM payables WHERE status = 'Unpaid'")->fetchColumn();
    $ar = $pdo->query("SELECT COALESCE(SUM(amount - amount_paid),0) FROM receivables")->fetchColumn();
}
if (in_array($role, ['Admin', 'Payroll Staff', 'Accountant'])) {
    $pm = $pdo->prepare("SELECT COALESCE(SUM(net_salary),0) FROM payroll WHERE DATE_FORMAT(period_end,'%Y-%m') = ?");
    $pm->execute([date('Y-m')]); $payroll_month = $pm->fetchColumn();
}
?>
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dashboard - AquaTrack ERP</title></head>
<body>
    <?php include 'includes/nav.php'; ?>
    <div class="content">
        <h2>Dashboard</h2>
        <p style="color:#7e8b98;margin-top:-8px">Welcome back, <?= htmlspecialchars($_SESSION['username']) ?>. Here&rsquo;s your AquaTrack water station overview.</p>
        <div class="stats">
            <div class="stat"><small>ACTIVE EMPLOYEES</small><b><?= $total_employees ?></b><i>Current team members</i></div>
            <div class="stat"><small>PRESENT TODAY</small><b><?= $present_today ?></b><i>Present or late</i></div>
            <div class="stat"><small>ABSENT TODAY</small><b><?= $absent_today ?></b><i>Marked absent</i></div>
            <div class="stat"><small>PENDING LEAVES</small><b><?= $pending_leaves ?></b><i>For HR review</i></div>
        </div>
        <?php if ($is_acc): ?><div class="stats">
            <div class="stat"><small>CASH &amp; BANK</small><b><?= money($cash) ?></b><i>From the General Ledger</i></div>
            <div class="stat"><small>NET INCOME</small><b class="<?= $ni < 0 ? 'neg' : 'pos' ?>"><?= money($ni) ?></b><i>Revenue minus expenses</i></div>
            <div class="stat"><small>OPEN PAYABLES</small><b><?= money($ap) ?></b><i>Owed to suppliers</i></div>
            <div class="stat"><small>OPEN RECEIVABLES</small><b><?= money($ar) ?></b><i>Owed by customers</i></div>
        </div><?php endif; ?>
        <?php if ($payroll_month): ?><div class="stats"><div class="stat"><small>PAYROLL THIS MONTH</small><b><?= money($payroll_month) ?></b><i>Net pay generated</i></div></div><?php endif; ?>
        <h3>Quick access</h3>
        <h3>Quick access</h3><div class="module-grid">
            <a class="module-card" href="employees.php"><div class="module-card-icon"><i class="fa-solid fa-user-tie"></i></div><div class="module-card-title">Employees</div></a>
            <a class="module-card" href="attendance.php"><div class="module-card-icon"><i class="fa-solid fa-calendar-check"></i></div><div class="module-card-title">Attendance</div></a>
            <a class="module-card" href="leave.php"><div class="module-card-icon"><i class="fa-solid fa-calendar-days"></i></div><div class="module-card-title">Leave</div></a>
            <?php if (in_array($role, ['Admin', 'Payroll Staff'])): ?><a class="module-card" href="payroll.php"><div class="module-card-icon"><i class="fa-solid fa-money-check-dollar"></i></div><div class="module-card-title">Payroll</div></a><?php endif; ?>
            <?php if ($is_acc): ?>
            <a class="module-card" href="journal.php"><div class="module-card-icon"><i class="fa-solid fa-file-lines"></i></div><div class="module-card-title">Journal Entries</div></a>
            <a class="module-card" href="ap.php"><div class="module-card-icon"><i class="fa-solid fa-credit-card"></i></div><div class="module-card-title">Accounts Payable</div></a>
            <a class="module-card" href="ar.php"><div class="module-card-icon"><i class="fa-solid fa-comments-dollar"></i></div><div class="module-card-title">Accounts Receivable</div></a>
            <a class="module-card" href="statements.php"><div class="module-card-icon"><i class="fa-solid fa-scale-balanced"></i></div><div class="module-card-title">Statements</div></a>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>
