<?php
require_once 'includes/auth.php';
require_login();

// FILE LEAVE REQUEST (any logged-in role can file for the linked employee)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['file_leave'])) {
    $stmt = $pdo->prepare("INSERT INTO leave_requests (employee_id, leave_type, date_from, date_to, reason)
                            VALUES (?,?,?,?,?)");
    $stmt->execute([
        $_POST['employee_id'], $_POST['leave_type'], $_POST['date_from'], $_POST['date_to'], $_POST['reason']
    ]);
    log_audit($pdo, 'CREATE', 'leave_requests', $pdo->lastInsertId(), "Filed {$_POST['leave_type']} leave");
    header("Location: leave.php");
    exit;
}

// APPROVE / REJECT (HR/Admin only)
if (isset($_GET['action']) && isset($_GET['leave_id'])) {
    require_role(['Admin', 'HR Staff']);
    $leave_id = $_GET['leave_id'];
    $action = $_GET['action'];

    [$owner_clause, $owner_params] = branch_scope_clause('e');
    $owner_check = $pdo->prepare("SELECT l.leave_id FROM leave_requests l
                                   JOIN employees e ON l.employee_id = e.employee_id
                                   WHERE l.leave_id = ? $owner_clause");
    $owner_check->execute(array_merge([$leave_id], $owner_params));
    if (!$owner_check->fetch()) {
        header("Location: leave.php");
        exit;
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("SELECT * FROM leave_requests WHERE leave_id = ?");
        $stmt->execute([$leave_id]);
        $leave = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($action === 'approve') {
            $days = (strtotime($leave['date_to']) - strtotime($leave['date_from'])) / 86400 + 1;
            $bal = $pdo->prepare("SELECT credits_remaining FROM leave_balances WHERE employee_id = ? AND leave_type = ?");
            $bal->execute([$leave['employee_id'], $leave['leave_type']]);
            $balance = $bal->fetch(PDO::FETCH_ASSOC);

            if ($balance && $balance['credits_remaining'] >= $days) {
                $deduct = $pdo->prepare("UPDATE leave_balances SET credits_remaining = credits_remaining - ?
                                          WHERE employee_id = ? AND leave_type = ?");
                $deduct->execute([$days, $leave['employee_id'], $leave['leave_type']]);
                $update = $pdo->prepare("UPDATE leave_requests SET status = 'Approved' WHERE leave_id = ?");
                $update->execute([$leave_id]);
                log_audit($pdo, 'APPROVE', 'leave_requests', $leave_id, "Approved, deducted $days days");
            } else {
                $update = $pdo->prepare("UPDATE leave_requests SET status = 'Rejected' WHERE leave_id = ?");
                $update->execute([$leave_id]);
                log_audit($pdo, 'REJECT', 'leave_requests', $leave_id, "Auto-rejected: insufficient balance");
            }
        } elseif ($action === 'reject') {
            $update = $pdo->prepare("UPDATE leave_requests SET status = 'Rejected' WHERE leave_id = ?");
            $update->execute([$leave_id]);
            log_audit($pdo, 'REJECT', 'leave_requests', $leave_id, "Manually rejected");
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
    }
    header("Location: leave.php");
    exit;
}

[$branch_clause, $branch_params] = branch_scope_clause('e');

$emp_stmt = $pdo->prepare("SELECT employee_id, first_name, last_name FROM employees e
                            WHERE archived = 0 AND employment_status != 'Resigned' $branch_clause");
$emp_stmt->execute($branch_params);
$employees = $emp_stmt->fetchAll(PDO::FETCH_ASSOC);

$req_stmt = $pdo->prepare("SELECT l.*, e.first_name, e.last_name FROM leave_requests l
                            JOIN employees e ON l.employee_id = e.employee_id
                            WHERE 1=1 $branch_clause ORDER BY l.filed_at DESC");
$req_stmt->execute($branch_params);
$requests = $req_stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html>
<head>
    <title>Leave Management - AquaTrack HR</title>
</head>
<body>
    <?php include 'includes/nav.php'; ?>
    <div class="content">
        <h2>Leave Management</h2>

        <div class="form-box">
            <h3>File Leave Request</h3>
            <form method="POST">
                <select name="employee_id" required>
                    <option value="">-- Select Employee --</option>
                    <?php foreach ($employees as $e): ?>
                        <option value="<?= $e['employee_id'] ?>"><?= htmlspecialchars($e['first_name'] . ' ' . $e['last_name']) ?></option>
                    <?php endforeach; ?>
                </select>
                <select name="leave_type" required>
                    <option value="Vacation">Vacation</option>
                    <option value="Sick">Sick</option>
                    <option value="Emergency">Emergency</option>
                </select>
                <label>From:</label>
                <input type="date" name="date_from" required>
                <label>To:</label>
                <input type="date" name="date_to" required>
                <textarea name="reason" placeholder="Reason"></textarea>
                <button class="btn" type="submit" name="file_leave">Submit Request</button>
            </form>
        </div>

        <h3>Leave Requests / History</h3>
        <table>
            <tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Status</th><th>Actions</th></tr>
            <?php foreach ($requests as $r): ?>
            <tr>
                <td><?= htmlspecialchars($r['first_name'] . ' ' . $r['last_name']) ?></td>
                <td><?= $r['leave_type'] ?></td>
                <td><?= $r['date_from'] ?></td>
                <td><?= $r['date_to'] ?></td>
                <td class="status-<?= $r['status'] ?>"><?= $r['status'] ?></td>
                <td>
                    <?php if ($r['status'] === 'Pending' && in_array($_SESSION['role'], ['Admin','HR Staff'])): ?>
                        <a class="btn" href="?action=approve&leave_id=<?= $r['leave_id'] ?>">Approve</a>
                        <a class="btn btn-danger" href="?action=reject&leave_id=<?= $r['leave_id'] ?>">Reject</a>
                    <?php endif; ?>
                </td>
            </tr>
            <?php endforeach; ?>
        </table>
    </div>
</body>
</html>
