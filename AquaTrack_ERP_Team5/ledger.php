<?php
require_once 'includes/accounting.php';
require_role(ACC_ROLES);
require_acc_branch();
$accts = $pdo->query("SELECT * FROM accounts ORDER BY account_code")->fetchAll();
$code = $_GET['account'] ?? ($accts[0]['account_code'] ?? '1000');
$acct = null; foreach ($accts as $a) if ($a['account_code'] === $code) $acct = $a;
$rows = [];
[$bq, $bp] = acc_branch_sql('j');
if ($acct) {
    $s = $pdo->prepare("SELECT j.entry_date, j.journal_id, j.description, l.debit, l.credit FROM journal_lines l
        JOIN journal_entries j ON j.journal_id = l.journal_id WHERE l.account_id = ? $bq ORDER BY j.entry_date, j.journal_id, l.line_id");
    $s->execute(array_merge([$acct['account_id']], $bp)); $rows = $s->fetchAll();
}
page_start('General Ledger'); ?>
<div class="box"><form method="GET">Account <select name="account" onchange="this.form.submit()">
<?php foreach ($accts as $a): ?><option value="<?= e($a['account_code']) ?>" <?= $a['account_code'] === $code ? 'selected' : '' ?>><?= e($a['account_code'] . ' - ' . $a['account_name']) ?></option><?php endforeach; ?>
</select></form></div>
<table><tr><th>Date</th><th>JE #</th><th>Description</th><th class="r">Debit</th><th class="r">Credit</th><th class="r">Balance</th></tr>
<?php $dr = 0; $cr = 0; foreach ($rows as $r): $dr += $r['debit']; $cr += $r['credit']; ?>
<tr><td><?= e($r['entry_date']) ?></td><td><?= $r['journal_id'] ?></td><td><?= e($r['description']) ?></td>
<td class="r"><?= $r['debit'] > 0 ? money($r['debit']) : '' ?></td><td class="r"><?= $r['credit'] > 0 ? money($r['credit']) : '' ?></td>
<td class="r"><?= money(normal_balance($acct['account_type'], $dr, $cr)) ?></td></tr><?php endforeach; ?>
<?php if (!$rows): ?><tr><td colspan="6">No postings for this account.</td></tr><?php endif; ?></table>
<?php page_end();
