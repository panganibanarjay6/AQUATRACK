<?php
require_once 'includes/accounting.php';
require_role(['Admin', 'Payroll Staff']);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['post_13th'])) {
    post_13th_to_accounting($pdo, (int)$_POST['thirteenth_month_id']);
    header("Location: thirteenth_month.php"); exit;
}
// GENERATE 13TH MONTH PAY = total basic pay earned during the year / 12
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['generate_13th'])) {
    $employee_id = $_POST['employee_id'];
    $year = $_POST['year'];

    $stmt = $pdo->prepare("SELECT SUM(basic_salary) as total FROM payroll
                            WHERE employee_id = ? AND YEAR(period_start) = ?");
    $stmt->execute([$employee_id, $year]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $total_basic = $row['total'] ?? 0;
    $thirteenth_month = round($total_basic / 12, 2);

    $insert = $pdo->prepare("INSERT INTO thirteenth_month_pay (employee_id, year, total_basic_pay_earned, thirteenth_month_amount)
                              VALUES (?,?,?,?)
                              ON DUPLICATE KEY UPDATE total_basic_pay_earned = VALUES(total_basic_pay_earned),
                                                       thirteenth_month_amount = VALUES(thirteenth_month_amount)");
    $insert->execute([$employee_id, $year, $total_basic, $thirteenth_month]);
    log_audit($pdo, 'CREATE', 'thirteenth_month_pay', $employee_id, "13th month for $year: $thirteenth_month");

    header("Location: thirteenth_month.php");
    exit;
}

[$branch_clause, $branch_params] = branch_scope_clause('e');
$emp_stmt = $pdo->prepare("SELECT employee_id, first_name, last_name FROM employees e WHERE archived = 0 $branch_clause");
$emp_stmt->execute($branch_params);
$employees = $emp_stmt->fetchAll(PDO::FETCH_ASSOC);
$rec_stmt = $pdo->prepare("SELECT t.*, e.first_name, e.last_name FROM thirteenth_month_pay t
                            JOIN employees e ON t.employee_id = e.employee_id
                            WHERE 1=1 $branch_clause ORDER BY t.year DESC");
$rec_stmt->execute($branch_params);
$records = $rec_stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html>
<head>
    <title>13th Month Pay - AquaTrack HR</title>
</head>
<body>
    <?php include 'includes/nav.php'; ?>
    <div class="content">
        <h2>13th Month Pay</h2>
        <div class="form-box">
            <form method="POST">
                <select name="employee_id" required>
                    <option value="">-- Select Employee --</option>
                    <?php foreach ($employees as $e): ?>
                        <option value="<?= $e['employee_id'] ?>"><?= htmlspecialchars($e['first_name'] . ' ' . $e['last_name']) ?></option>
                    <?php endforeach; ?>
                </select>
                <input type="number" name="year" placeholder="Year (e.g. 2026)" required>
                <button class="btn" type="submit" name="generate_13th">Compute 13th Month</button>
            </form>
        </div>

        <table>
            <tr><th>Employee</th><th>Year</th><th>Total Basic Pay Earned</th><th>13th Month Amount</th><th>Accounting</th></tr>
            <?php foreach ($records as $r): ?>
            <tr>
                <td><?= htmlspecialchars($r['first_name'] . ' ' . $r['last_name']) ?></td>
                <td><?= $r['year'] ?></td>
                <td><?= number_format($r['total_basic_pay_earned'], 2) ?></td>
                <td><strong><?= number_format($r['thirteenth_month_amount'], 2) ?></strong></td>
                <td><?php if ($r['posted_to_accounting']): ?>Posted (JE #<?= $r['journal_id'] ?>)<?php else: ?>
                    <form method="POST" style="margin:0"><input type="hidden" name="thirteenth_month_id" value="<?= $r['thirteenth_month_id'] ?>">
                    <button class="btn" name="post_13th" type="submit">Post to Accounting</button></form><?php endif; ?></td>
            </tr>
            <?php endforeach; ?>
        </table>
    </div>
</body>
</html>
