<?php
require_once 'includes/accounting.php';
require_role(ACC_ROLES);
require_acc_branch();
$error = ''; $ok = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $a = (float)$_POST['amount']; if ($a <= 0) throw new Exception('Amount must be greater than 0.');
        $dep = $_POST['type'] === 'deposit';
        post_journal($pdo, $_POST['tx_date'], 'BankTransfer', null, $dep ? 'Deposit: cash to bank' : 'Withdrawal: bank to cash', $dep ? [['1010', $a, 0], ['1000', 0, $a]] : [['1000', $a, 0], ['1010', 0, $a]]);
        $ok = 'Transaction posted.';
    } catch (Exception $x) { $error = $x->getMessage(); }
}
$bal = []; foreach (account_totals($pdo, null, '9999-12-31') as $r) if (in_array($r['account_code'], ['1000', '1010'])) $bal[$r['account_code']] = $r['dr'] - $r['cr'];
[$bq, $bp] = acc_branch_sql('j');
$st = $pdo->prepare("SELECT j.entry_date, j.description, a.account_code, l.debit, l.credit FROM journal_lines l JOIN accounts a ON a.account_id = l.account_id
    JOIN journal_entries j ON j.journal_id = l.journal_id WHERE a.account_code IN ('1000','1010') $bq ORDER BY j.entry_date DESC, j.journal_id DESC LIMIT 200");
$st->execute($bp);
$tx = $st->fetchAll();
page_start('Cash & Bank'); msg($error, $ok); ?>
<p>Cash on hand: <strong><?= money($bal['1000'] ?? 0) ?></strong> &nbsp; Cash in bank: <strong><?= money($bal['1010'] ?? 0) ?></strong></p>
<div class="box"><form method="POST"><select name="type"><option value="deposit">Deposit (cash to bank)</option><option value="withdraw">Withdraw (bank to cash)</option></select>
<input type="date" name="tx_date" value="<?= date('Y-m-d') ?>" required><input type="number" name="amount" step="0.01" min="0.01" placeholder="Amount" required><button class="btn">Post</button></form></div>
<table><tr><th>Date</th><th>Account</th><th>Description</th><th class="r">In</th><th class="r">Out</th></tr>
<?php foreach ($tx as $t): ?><tr><td><?= e($t['entry_date']) ?></td><td><?= $t['account_code'] === '1000' ? 'Cash' : 'Bank' ?></td><td><?= e($t['description']) ?></td>
<td class="r"><?= $t['debit'] > 0 ? money($t['debit']) : '' ?></td><td class="r"><?= $t['credit'] > 0 ? money($t['credit']) : '' ?></td></tr><?php endforeach; ?></table>
<?php page_end();
