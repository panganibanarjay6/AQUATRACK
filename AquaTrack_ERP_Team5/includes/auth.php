<?php
// includes/auth.php - session handling, role checks, audit logging
session_start();
require_once __DIR__ . '/../config/db.php';

function require_login() {
    if (!isset($_SESSION['user_id'])) {
        header("Location: login.php");
        exit;
    }
}

// Restrict a page to specific roles, e.g. require_role(['Admin','HR Staff'])
function require_role(array $allowed_roles) {
    require_login();
    if (!in_array($_SESSION['role'], $allowed_roles)) {
        http_response_code(403);
        die("Access denied. Your role (" . htmlspecialchars($_SESSION['role']) . ") cannot view this page.");
    }
}

// Returns the logged-in user's branch_id, or null if they aren't branch-locked (Admin/Payroll Staff)
function current_branch_id() {
    return $_SESSION['branch_id'] ?? null;
}

function is_branch_locked() {
    // Admin and Payroll Staff see all branches; HR Staff (and Employee) are locked to their own
    return !in_array($_SESSION['role'], ['Admin', 'Payroll Staff']) && current_branch_id() !== null;
}

// Appends a "AND {alias}.branch_id = ?" clause when the user is branch-locked.
// Returns [sql_fragment, params_to_merge]. Use like:
//   [$clause, $params] = branch_scope_clause('e');
//   $sql = "SELECT * FROM employees e WHERE 1=1 $clause";
function branch_scope_clause($alias = 'e') {
    if (is_branch_locked()) {
        return [" AND $alias.branch_id = ? ", [current_branch_id()]];
    }
    $b = (int)($_SESSION['hr_branch'] ?? 0);
    if ($b > 0) return [" AND $alias.branch_id = ? ", [$b]];
    return ['', []];
}

// Write an audit trail entry. Call this after every insert/update/delete.
function log_audit($pdo, $action, $table_name, $record_id, $details = '') {
    $user_id = $_SESSION['user_id'] ?? null;
    $stmt = $pdo->prepare("INSERT INTO audit_log (user_id, action, table_name, record_id, details)
                            VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$user_id, $action, $table_name, $record_id, $details]);
}
