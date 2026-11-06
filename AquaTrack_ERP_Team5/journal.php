<?php
require_once 'includes/accounting.php';
require_role(ACC_ROLES);
require_acc_branch();
$error = ''; $ok = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if ($_POST['debit'] === $_POST['credit']) throw new Exception('Debit and credit accounts must be different.');
        $a = (float)$_POST['amount'];
        if ($a <= 0 || trim($_POST['description']) === '') throw new Exception('Description and an amount greater than 0 are required.');
        $jid = post_journal($pdo, $_POST['entry_date'], 'Manual', null, trim($_POST['description']), [[$_POST['debit'], $a, 0], [$_POST['credit'], 0, $a]]);
        $ok = "Journal entry #$jid posted.";
    } catch (Exception $x) { $error = $x->getMessage(); }
}
$accts = $pdo->query("SELECT account_code, account_name FROM accounts WHERE is_active = 1 ORDER BY account_code")->fetchAll();
[$bq, $bp] = acc_branch_sql('j');
$st = $pdo->prepare("SELECT j.*, a.account_code, a.account_name, l.debit, l.credit FROM journal_entries j
    JOIN journal_lines l ON l.journal_id = j.journal_id JOIN accounts a ON a.account_id = l.account_id
    WHERE 1=1 $bq ORDER BY j.journal_id DESC, l.line_id LIMIT 400");
$st->execute($bp);
$lines = $st->fetchAll();
$entries = []; foreach ($lines as $l) $entries[$l['journal_id']][] = $l;
page_start('Journal Entries'); msg($error, $ok);
$opts = ''; foreach ($accts as $a) $opts .= '<option value="' . e($a['account_code']) . '">' . e($a['account_code'] . ' - ' . $a['account_name']) . '</option>'; ?>
<div class="box"><form method="POST">
    <input type="date" name="entry_date" value="<?= date('Y-m-d') ?>" required>
    <input name="description" placeholder="Description" required size="30">
    Debit <select name="debit"><?= $opts ?></select> Credit <select name="credit"><?= $opts ?></select>
    <input type="number" name="amount" step="0.01" min="0.01" placeholder="Amount" required>
    <button class="btn">Post entry</button></form></div>
<table><tr><th>JE #</th><th>Date</th><th>Description</th><th>Reference</th><th>Account</th><th class="r">Debit</th><th class="r">Credit</th></tr>
<?php foreach ($entries as $jid => $ls): foreach ($ls as $i => $l): ?><tr>
<?php if ($i === 0): ?><td rowspan="<?= count($ls) ?>"><?= $jid ?></td><td rowspan="<?= count($ls) ?>"><?= e($l['entry_date']) ?></td>
<td rowspan="<?= count($ls) ?>"><?= e($l['description']) ?></td><td rowspan="<?= count($ls) ?>"><?= e($l['reference_type']) ?> <?= e($l['reference_id']) ?></td><?php endif; ?>
<td><?= e($l['account_code'] . ' - ' . $l['account_name']) ?></td><td class="r"><?= $l['debit'] > 0 ? money($l['debit']) : '' ?></td><td class="r"><?= $l['credit'] > 0 ? money($l['credit']) : '' ?></td></tr>
<?php endforeach; endforeach; ?></table>
<?php page_end();
