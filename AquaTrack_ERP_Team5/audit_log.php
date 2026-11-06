<?php
require_once 'includes/accounting.php';
require_role(['Admin']);
$rows = $pdo->query("SELECT a.*, u.username FROM audit_log a LEFT JOIN users u ON a.user_id = u.user_id ORDER BY a.log_id DESC LIMIT 300")->fetchAll();
page_start('Audit Trail'); ?>
<table><tr><th>Time</th><th>User</th><th>Action</th><th>Table</th><th>Record</th><th>Details</th></tr>
<?php foreach ($rows as $r): ?><tr><td><?= e($r['logged_at']) ?></td><td><?= e($r['username'] ?? '-') ?></td><td><?= e($r['action']) ?></td><td><?= e($r['table_name']) ?></td><td><?= e($r['record_id']) ?></td><td><?= e($r['details']) ?></td></tr><?php endforeach; ?></table>
<?php page_end();
