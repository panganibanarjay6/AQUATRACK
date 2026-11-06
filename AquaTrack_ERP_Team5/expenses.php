<?php
require_once 'includes/accounting.php';
require_role(ACC_ROLES);
require_acc_branch();
$error = ''; $ok = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $a = (float)$_POST['amount'];
        if ($a <= 0 || trim($_POST['description']) === '') throw new Exception('Description and an amount greater than 0 are required.');
        if (!in_array($_POST['pay_from'], ['1000', '1010'])) throw new Exception('Invalid payment account.');
        post_journal($pdo, $_POST['entry_date'], 'Expense', null, trim($_POST['description']), [[$_POST['expense'], $a, 0], [$_POST['pay_from'], 0, $a]]);
        $ok = 'Expense recorded and posted to the journal.';
    } catch (Exception $x) { $error = $x->getMessage(); }
}
$accts = $pdo->query("SELECT account_code, account_name FROM accounts WHERE account_type = 'Expense' AND is_active = 1 ORDER BY account_code")->fetchAll();
[$bq, $bp] = acc_branch_sql('j');
$st = $pdo->prepare("SELECT j.entry_date, j.journal_id, j.description, a.account_name, l.debit FROM journal_lines l JOIN accounts a ON a.account_id = l.account_id
    JOIN journal_entries j ON j.journal_id = l.journal_id WHERE a.account_type = 'Expense' AND l.debit > 0 $bq ORDER BY j.entry_date DESC, j.journal_id DESC LIMIT 200");
$st->execute($bp);
$rows = $st->fetchAll();
$total = array_sum(array_column($rows, 'debit'));
page_start('Expenses'); msg($error, $ok); ?>
<div class="box"><form method="POST"><input type="date" name="entry_date" value="<?= date('Y-m-d') ?>" required><input name="description" placeholder="Description (e.g. Electricity bill)" size="28" required>
<select name="expense"><?php foreach ($accts as $a) echo '<option value="' . e($a['account_code']) . '">' . e($a['account_code'] . ' - ' . $a['account_name']) . '</option>'; ?></select>
<input type="number" name="amount" step="0.01" min="0.01" placeholder="Amount" required><select name="pay_from"><option value="1000">Cash on Hand</option><option value="1010">Cash in Bank</option></select>
<button class="btn">Record expense</button></form></div>
<p>Total shown: <strong><?= money($total) ?></strong></p>
<table><tr><th>Date</th><th>JE #</th><th>Description</th><th>Account</th><th class="r">Amount</th></tr>
<?php foreach ($rows as $r): ?><tr><td><?= e($r['entry_date']) ?></td><td><?= $r['journal_id'] ?></td><td><?= e($r['description']) ?></td><td><?= e($r['account_name']) ?></td><td class="r"><?= money($r['debit']) ?></td></tr><?php endforeach; ?>
<?php if (!$rows): ?><tr><td colspan="5">No expenses yet.</td></tr><?php endif; ?></table>
<?php page_end();
