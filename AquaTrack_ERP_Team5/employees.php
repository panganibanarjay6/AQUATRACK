<?php
require_once 'includes/auth.php';
require_role(['Admin', 'HR Staff']);

// CREATE
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['add_employee'])) {
    // If this HR staff account is branch-locked, force the new employee into that branch
    // regardless of what the form submitted, so they can't add staff to another branch.
    $branch_id = is_branch_locked() ? current_branch_id() : $_POST['branch_id'];

    $stmt = $pdo->prepare("INSERT INTO employees
        (first_name, last_name, address, contact_number, email, department_id, branch_id, position,
         date_hired, employment_status, basic_salary, sss_no, philhealth_no, pagibig_no, tin_no)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $stmt->execute([
        $_POST['first_name'], $_POST['last_name'], $_POST['address'], $_POST['contact_number'],
        $_POST['email'], $_POST['department_id'], $branch_id, $_POST['position'], $_POST['date_hired'],
        $_POST['employment_status'], $_POST['basic_salary'], $_POST['sss_no'],
        $_POST['philhealth_no'], $_POST['pagibig_no'], $_POST['tin_no']
    ]);
    $new_id = $pdo->lastInsertId();
    foreach (['Vacation', 'Sick', 'Emergency'] as $type) {
        $init = $pdo->prepare("INSERT INTO leave_balances (employee_id, leave_type, credits_remaining) VALUES (?, ?, 5)");
        $init->execute([$new_id, $type]);
    }
    log_audit($pdo, 'CREATE', 'employees', $new_id, "Added employee {$_POST['first_name']} {$_POST['last_name']}");
    header("Location: employees.php");
    exit;
}

// UPDATE
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['update_employee'])) {
    $stmt = $pdo->prepare("UPDATE employees SET
        first_name=?, last_name=?, address=?, contact_number=?, email=?, department_id=?,
        position=?, employment_status=?, basic_salary=? WHERE employee_id=?");
    $stmt->execute([
        $_POST['first_name'], $_POST['last_name'], $_POST['address'], $_POST['contact_number'],
        $_POST['email'], $_POST['department_id'], $_POST['position'],
        $_POST['employment_status'], $_POST['basic_salary'], $_POST['employee_id']
    ]);
    log_audit($pdo, 'UPDATE', 'employees', $_POST['employee_id'], "Updated employee record");
    header("Location: employees.php");
    exit;
}

// ARCHIVE (soft delete)
if (isset($_GET['archive'])) {
    $id = $_GET['archive'];
    [$clause, $scope_params] = branch_scope_clause('e');
    // Confirm this employee is within the current user's branch scope before archiving
    $check = $pdo->prepare("SELECT employee_id FROM employees e WHERE e.employee_id = ? $clause");
    $check->execute(array_merge([$id], $scope_params));
    if ($check->fetch()) {
        $stmt = $pdo->prepare("UPDATE employees SET archived = 1, employment_status = 'Resigned' WHERE employee_id = ?");
        $stmt->execute([$id]);
        log_audit($pdo, 'ARCHIVE', 'employees', $id, "Archived employee");
    }
    header("Location: employees.php");
    exit;
}

// Validation helper (basic server-side checks, mirrors client-side `required`)
$errors = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['add_employee'])) {
    if (empty($_POST['first_name']) || empty($_POST['last_name'])) $errors[] = "Name is required.";
    if (!is_numeric($_POST['basic_salary']) || $_POST['basic_salary'] < 0) $errors[] = "Basic salary must be a positive number.";
}

// SEARCH / FILTER
$search = $_GET['search'] ?? '';
$dept_filter = $_GET['department_id'] ?? '';
$status_filter = $_GET['status'] ?? '';
$branch_filter = $_GET['branch_id'] ?? ''; // only usable by Admin/Payroll Staff (not branch-locked)

$sql = "SELECT e.*, d.department_name, b.branch_name FROM employees e
        LEFT JOIN departments d ON e.department_id = d.department_id
        LEFT JOIN branches b ON e.branch_id = b.branch_id
        WHERE e.archived = 0";
$params = [];

[$branch_clause, $branch_params] = branch_scope_clause('e');
$sql .= $branch_clause;
$params = array_merge($params, $branch_params);

if ($search !== '') {
    $sql .= " AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.position LIKE ?)";
    $params[] = "%$search%"; $params[] = "%$search%"; $params[] = "%$search%";
}
if ($dept_filter !== '') {
    $sql .= " AND e.department_id = ?";
    $params[] = $dept_filter;
}
if ($status_filter !== '') {
    $sql .= " AND e.employment_status = ?";
    $params[] = $status_filter;
}
if (!is_branch_locked() && $branch_filter !== '') {
    $sql .= " AND e.branch_id = ?";
    $params[] = $branch_filter;
}
$sql .= " ORDER BY e.employee_id DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$employees = $stmt->fetchAll(PDO::FETCH_ASSOC);
$departments = $pdo->query("SELECT * FROM departments")->fetchAll(PDO::FETCH_ASSOC);
$branches = $pdo->query("SELECT * FROM branches ORDER BY branch_id")->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html>
<head>
    <title>Employee Management - AquaTrack HR</title>
</head>
<body>
    <?php include 'includes/nav.php'; ?>
    <div class="content">
        <h2>Employee Management</h2>

        <?php foreach ($errors as $e): ?><p class="error"><?= htmlspecialchars($e) ?></p><?php endforeach; ?>

        <div class="form-box">
            <h3>Add Employee</h3>
            <form method="POST">
                <input type="text" name="first_name" placeholder="First Name" required>
                <input type="text" name="last_name" placeholder="Last Name" required>
                <input type="text" name="address" placeholder="Address">
                <input type="text" name="contact_number" placeholder="Contact Number" pattern="[0-9+\-\s]{7,15}">
                <input type="email" name="email" placeholder="Email">
                <?php if (is_branch_locked()): ?>
                    <input type="hidden" name="branch_id" value="<?= current_branch_id() ?>">
                    <p style="margin:0 0 8px; font-size:13px; color:#64748b;">
                        Branch: <?php
                            $b = array_filter($branches, fn($x) => $x['branch_id'] == current_branch_id());
                            echo htmlspecialchars(reset($b)['branch_name'] ?? '-');
                        ?>
                    </p>
                <?php else: ?>
                    <select name="branch_id" required>
                        <?php foreach ($branches as $b): ?>
                            <option value="<?= $b['branch_id'] ?>"><?= htmlspecialchars($b['branch_name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                <?php endif; ?>
                <select name="department_id" required>
                    <?php foreach ($departments as $d): ?>
                        <option value="<?= $d['department_id'] ?>"><?= htmlspecialchars($d['department_name']) ?></option>
                    <?php endforeach; ?>
                </select>
                <input type="text" name="position" placeholder="Position" required>
                <label>Date Hired:</label>
                <input type="date" name="date_hired" required>
                <select name="employment_status">
                    <option value="Probationary">Probationary</option>
                    <option value="Regular">Regular</option>
                </select>
                <input type="number" step="0.01" min="0" name="basic_salary" placeholder="Basic Salary" required>
                <input type="text" name="sss_no" placeholder="SSS No.">
                <input type="text" name="philhealth_no" placeholder="PhilHealth No.">
                <input type="text" name="pagibig_no" placeholder="Pag-IBIG No.">
                <input type="text" name="tin_no" placeholder="TIN No.">
                <button class="btn" type="submit" name="add_employee">Add Employee</button>
            </form>
        </div>

        <form method="GET" class="filters">
            <input type="text" name="search" placeholder="Search name/position" value="<?= htmlspecialchars($search) ?>">
            <?php if (!is_branch_locked()): ?>
            <select name="branch_id">
                <option value="">All Branches</option>
                <?php foreach ($branches as $b): ?>
                    <option value="<?= $b['branch_id'] ?>" <?= $branch_filter == $b['branch_id'] ? 'selected' : '' ?>>
                        <?= htmlspecialchars($b['branch_name']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
            <?php endif; ?>
            <select name="department_id">
                <option value="">All Departments</option>
                <?php foreach ($departments as $d): ?>
                    <option value="<?= $d['department_id'] ?>" <?= $dept_filter == $d['department_id'] ? 'selected' : '' ?>>
                        <?= htmlspecialchars($d['department_name']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
            <select name="status">
                <option value="">All Status</option>
                <option value="Regular" <?= $status_filter === 'Regular' ? 'selected' : '' ?>>Regular</option>
                <option value="Probationary" <?= $status_filter === 'Probationary' ? 'selected' : '' ?>>Probationary</option>
            </select>
            <button class="btn" type="submit">Filter</button>
        </form>

        <table>
            <tr><th>ID</th><th>Name</th><th>Branch</th><th>Department</th><th>Position</th><th>Status</th><th>Salary</th><th>Actions</th></tr>
            <?php foreach ($employees as $e): ?>
            <tr>
                <td><?= $e['employee_id'] ?></td>
                <td><?= htmlspecialchars($e['first_name'] . ' ' . $e['last_name']) ?></td>
                <td><?= htmlspecialchars($e['branch_name'] ?? '-') ?></td>
                <td><?= htmlspecialchars($e['department_name'] ?? '-') ?></td>
                <td><?= htmlspecialchars($e['position']) ?></td>
                <td><?= $e['employment_status'] ?></td>
                <td><?= number_format($e['basic_salary'], 2) ?></td>
                <td>
                    <a class="btn" href="employee_profile.php?id=<?= $e['employee_id'] ?>">View</a>
                    <a class="btn btn-danger" href="?archive=<?= $e['employee_id'] ?>"
                       onclick="return confirm('Archive this employee?')">Archive</a>
                </td>
            </tr>
            <?php endforeach; ?>
        </table>
    </div>
</body>
</html>
