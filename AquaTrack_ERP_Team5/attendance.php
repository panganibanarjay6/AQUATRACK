<?php
require_once 'includes/auth.php';
require_role(['Admin', 'HR Staff']);

$standard_shift_hours = 8;

// TIME IN
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['time_in'])) {
    $employee_id = $_POST['employee_id'];
    $today = date('Y-m-d');
    $now = date('H:i:s');
    $status = ($now > '08:00:00') ? 'Late' : 'Present';

    $stmt = $pdo->prepare("INSERT INTO attendance (employee_id, attendance_date, time_in, status)
                            VALUES (?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE time_in = VALUES(time_in), status = VALUES(status)");
    $stmt->execute([$employee_id, $today, $now, $status]);
    log_audit($pdo, 'CREATE', 'attendance', $employee_id, "Time in at $now ($status)");
    header("Location: attendance.php");
    exit;
}

// TIME OUT (also computes overtime beyond the standard shift)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['time_out'])) {
    $employee_id = $_POST['employee_id'];
    $today = date('Y-m-d');
    $now = date('H:i:s');

    $stmt = $pdo->prepare("SELECT time_in FROM attendance WHERE employee_id = ? AND attendance_date = ?");
    $stmt->execute([$employee_id, $today]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $overtime = 0;
    if ($row && $row['time_in']) {
        $hours_worked = (strtotime($now) - strtotime($row['time_in'])) / 3600;
        $overtime = max(0, round($hours_worked - $standard_shift_hours, 2));
    }

    $update = $pdo->prepare("UPDATE attendance SET time_out = ?, overtime_hours = ?
                              WHERE employee_id = ? AND attendance_date = ?");
    $update->execute([$now, $overtime, $employee_id, $today]);
    log_audit($pdo, 'UPDATE', 'attendance', $employee_id, "Time out at $now, OT: $overtime hrs");
    header("Location: attendance.php");
    exit;
}

// Mark absentees for a date
if (isset($_GET['mark_absent'])) {
    $date = $_GET['mark_absent'];
    [$mclause, $mparams] = branch_scope_clause('e');
    $stmt = $pdo->prepare("INSERT INTO attendance (employee_id, attendance_date, status)
        SELECT e.employee_id, ?, 'Absent' FROM employees e
        WHERE e.employment_status IN ('Regular','Probationary') AND e.archived = 0 $mclause
        AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.employee_id = e.employee_id AND a.attendance_date = ?)");
    $stmt->execute(array_merge([$date], $mparams, [$date]));
    log_audit($pdo, 'CREATE', 'attendance', null, "Batch marked absentees for $date");
    header("Location: attendance.php?date=$date");
    exit;
}

$filterDate = $_GET['date'] ?? date('Y-m-d');

[$branch_clause, $branch_params] = branch_scope_clause('e');
$emp_stmt = $pdo->prepare("SELECT employee_id, first_name, last_name FROM employees e
                            WHERE archived = 0 AND employment_status != 'Resigned' $branch_clause");
$emp_stmt->execute($branch_params);
$employees = $emp_stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->prepare("SELECT a.*, e.first_name, e.last_name FROM attendance a
                        JOIN employees e ON a.employee_id = e.employee_id
                        WHERE a.attendance_date = ? $branch_clause ORDER BY a.time_in ASC");
$stmt->execute(array_merge([$filterDate], $branch_params));
$records = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html>
<head>
    <title>Attendance - AquaTrack HR</title>
</head>
<body>
    <?php include 'includes/nav.php'; ?>
    <div class="content">
        <h2>Attendance - <?= htmlspecialchars($filterDate) ?></h2>

        <form method="GET" class="form-inline">
            <label>View Date:</label>
            <input type="date" name="date" value="<?= htmlspecialchars($filterDate) ?>">
            <button class="btn" type="submit">Filter</button>
            <a class="btn" href="?mark_absent=<?= $filterDate ?>"
               onclick="return confirm('Mark all employees without a record as Absent?')">Mark Absentees</a>
        </form>

        <div class="form-inline">
            <form method="POST">
                <select name="employee_id" required>
                    <option value="">-- Select Employee --</option>
                    <?php foreach ($employees as $e): ?>
                        <option value="<?= $e['employee_id'] ?>"><?= htmlspecialchars($e['first_name'] . ' ' . $e['last_name']) ?></option>
                    <?php endforeach; ?>
                </select>
                <button class="btn" type="submit" name="time_in">Time In</button>
                <button class="btn" type="submit" name="time_out">Time Out</button>
            </form>
        </div>

        <table>
            <tr><th>Employee</th><th>Time In</th><th>Time Out</th><th>Overtime (hrs)</th><th>Status</th></tr>
            <?php foreach ($records as $r): ?>
            <tr>
                <td><?= htmlspecialchars($r['first_name'] . ' ' . $r['last_name']) ?></td>
                <td><?= $r['time_in'] ?? '-' ?></td>
                <td><?= $r['time_out'] ?? '-' ?></td>
                <td><?= $r['overtime_hours'] ?></td>
                <td class="status-<?= $r['status'] ?>"><?= $r['status'] ?></td>
            </tr>
            <?php endforeach; ?>
        </table>
    </div>
</body>
</html>
