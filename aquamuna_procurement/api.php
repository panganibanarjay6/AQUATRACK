<?php
// JSON endpoint: login / logout / save. Everything else is rendered by index.php.
require_once __DIR__ . '/includes/db.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function out(array $a, int $code = 200): never { http_response_code($code); echo json_encode($a, JSON_UNESCAPED_UNICODE); exit; }
$raw = file_get_contents('php://input') ?: '{}';
$in = json_decode($raw, true) ?: [];
$a = $_GET['a'] ?? '';

try {
    if ($a === 'login') {
        $st = db()->prepare('SELECT * FROM users WHERE username = ? AND active = 1');
        $st->execute([strtolower(trim($in['u'] ?? ''))]);
        $u = $st->fetch();
        if (!$u || !password_verify((string)($in['p'] ?? ''), $u['password_hash'])) out(['ok' => false, 'error' => 'Wrong username or password.'], 401);
        session_regenerate_id(true);
        $_SESSION['user'] = ['u' => $u['username'], 'role' => $u['role'], 'name' => $u['full_name']];
        out(['ok' => true]);
    }
    if ($a === 'logout') { $_SESSION = []; session_destroy(); out(['ok' => true]); }

    if (empty($_SESSION['user'])) out(['ok' => false, 'error' => 'Please sign in again.'], 401);

    if ($a === 'save') {
        $obj = json_decode($raw);              // keep {} and [] exactly as the app sent them
        $parts = is_object($obj) && isset($obj->parts) ? (array)$obj->parts : null;
        if (!$parts) out(['ok' => false, 'error' => 'Nothing to save.'], 400);
        save_state($parts);
        out(['ok' => true]);
    }
    out(['ok' => false, 'error' => 'Unknown action.'], 404);
} catch (Throwable $e) {
    out(['ok' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
}
