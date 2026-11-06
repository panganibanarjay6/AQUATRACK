<?php
require_once 'includes/auth.php';
require_role(['Admin']);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['add_user'])) {
    $hash = password_hash($_POST['password'], PASSWORD_DEFAULT);
    // Branch is only relevant for HR Staff; other roles are not branch-locked
    $branch_id = ($_POST['role'] === 'HR Staff') ? $_POST['branch_id'] : null;

    $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role, branch_id) VALUES (?,?,?,?)");
    $stmt->execute([$_POST['username'], $hash, $_POST['role'], $branch_id]);
    log_audit($pdo, 'CREATE', 'users', $pdo->lastInsertId(), "Created user {$_POST['username']} ({$_POST['role']})");
    header("Location: users.php");
    exit;
}

$branches = $pdo->query("SELECT * FROM branches ORDER BY branch_id")->fetchAll(PDO::FETCH_ASSOC);
$users = $pdo->query("SELECT u.*, b.branch_name FROM users u
                       LEFT JOIN branches b ON u.branch_id = b.branch_id
                       ORDER BY u.user_id DESC")->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html>
<head>
    <title>User Accounts - AquaTrack HR</title>
</head>
<body>
    <?php include 'includes/nav.php'; ?>
    <div class="content">
        <h2>User Accounts</h2>

        <div class="form-box">
            <h3>Create User</h3>
            <form method="POST">
                <input type="text" name="username" placeholder="Username" required>
                <input type="password" name="password" placeholder="Password" required>
                <select name="role" id="roleSelect" onchange="toggleBranch()" required>
                    <option value="Admin">Admin</option>
                    <option value="HR Staff">HR Staff</option>
                    <option value="Payroll Staff">Payroll Staff</option>
                    <option value="Accountant">Accountant</option>
                </select>
                <div id="branchField">
                    <select name="branch_id">
                        <option value="">-- Assign Branch (HR Staff only) --</option>
                        <?php foreach ($branches as $b): ?>
                            <option value="<?= $b['branch_id'] ?>"><?= htmlspecialchars($b['branch_name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <button class="btn" type="submit" name="add_user">Create User</button>
            </form>
        </div>

        <table>
            <tr><th>Username</th><th>Role</th><th>Branch</th><th>Created</th></tr>
            <?php foreach ($users as $u): ?>
            <tr>
                <td><?= htmlspecialchars($u['username']) ?></td>
                <td><?= $u['role'] ?></td>
                <td><?= htmlspecialchars($u['branch_name'] ?? 'All Branches') ?></td>
                <td><?= $u['created_at'] ?></td>
            </tr>
            <?php endforeach; ?>
        </table>
    </div>

    <script>
        function toggleBranch() {
            const role = document.getElementById('roleSelect').value;
            document.getElementById('branchField').style.display = (role === 'HR Staff') ? 'block' : 'none';
        }
        toggleBranch();
    </script>
</body>
</html>
