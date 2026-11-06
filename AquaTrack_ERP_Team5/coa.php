<?php
require_once 'includes/accounting.php';
require_role(ACC_ROLES);
require_acc_branch();
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $code = trim($_POST['code']); $name = trim($_POST['name']); $type = $_POST['type'];
        if (!preg_match('/^\d{4}$/', $code) || $name === '' || !in_array($type, ACC_TYPES)) throw new Exception('Code must be 4 digits, with a name and a valid type.');
        $pdo->prepare("INSERT INTO accounts (account_code, account_name, account_type) VALUES (?,?,?)")->execute([$code, $name, $type]);
        log_audit($pdo, 'CREATE', 'accounts', $pdo->lastInsertId(), "$code $name");
        header('Location: coa.php'); exit;
    } catch (PDOException $x) { $error = 'Account code already exists.'; }
    catch (Exception $x) { $error = $x->getMessage(); }
}
$rows = account_totals($pdo, null, '9999-12-31');
page_start('Chart of Accounts'); msg($error); ?>
<div class="box"><form method="POST">
    <input name="code" placeholder="Code (4 digits)" maxlength="4" required>
    <input name="name" placeholder="Account name" required>
    <select name="type"><?php foreach (ACC_TYPES as $t) echo "<option>$t</option>"; ?></select>
    <button class="btn">Add account</button></form></div>
<table><tr><th>Code</th><th>Account</th><th>Type</th><th class="r">Balance</th></tr>
<?php foreach ($rows as $r): ?><tr><td><?= e($r['account_code']) ?></td><td><?= e($r['account_name']) ?></td><td><?= e($r['account_type']) ?></td>
<td class="r"><?= money(normal_balance($r['account_type'], $r['dr'], $r['cr'])) ?></td></tr><?php endforeach; ?></table>
<?php page_end();
