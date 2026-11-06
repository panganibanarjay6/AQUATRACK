<?php
require_once 'includes/accounting.php';
require_role(ACC_ROLES);
require_acc_branch();
$error = ''; $ok = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (isset($_POST['add'])) {
            create_payable($pdo, ['supplier_name' => trim($_POST['supplier_name']), 'po_id' => $_POST['po_id'] ?: null, 'invoice_no' => trim($_POST['invoice_no']),
                'invoice_date' => $_POST['invoice_date'], 'due_date' => $_POST['due_date'], 'amount' => $_POST['amount'], 'charge_code' => $_POST['charge_code']]);
            $ok = 'Purchase invoice recorded and posted to the journal.';
        } elseif (isset($_POST['pay'])) {
            $s = $pdo->prepare("SELECT * FROM payables WHERE payable_id = ? AND status = 'Unpaid'"); $s->execute([(int)$_POST['payable_id']]); $p = $s->fetch();
            if (!$p) throw new Exception('Payable not found or already paid.');
            if (!in_array($_POST['pay_from'], ['1000', '1010'])) throw new Exception('Invalid payment account.');
            $pdo->beginTransaction();
            $jid = post_journal($pdo, $_POST['pay_date'], 'Payable', (int)$p['payable_id'], "Payment to {$p['supplier_name']} ({$p['invoice_no']})", [['2000', $p['amount'], 0], [$_POST['pay_from'], 0, $p['amount']]], $p['branch_id'] ? (int)$p['branch_id'] : null);
            $pdo->prepare("UPDATE payables SET status = 'Paid', paid_date = ? WHERE payable_id = ?")->execute([$_POST['pay_date'], $p['payable_id']]);
            log_audit($pdo, 'UPDATE', 'payables', $p['payable_id'], 'Paid');
            $pdo->commit(); $ok = 'Payment recorded.';
        }
    } catch (Exception $x) { if ($pdo->inTransaction()) $pdo->rollBack(); $error = $x->getMessage(); }
}
$charge = $pdo->query("SELECT account_code, account_name FROM accounts WHERE account_type IN ('Asset','Expense') AND account_code NOT IN ('1000','1010','1100') AND is_active = 1 ORDER BY account_code")->fetchAll();
[$bq, $bp] = acc_branch_sql('p');
$st = $pdo->prepare("SELECT * FROM payables p WHERE 1=1 $bq ORDER BY payable_id DESC"); $st->execute($bp); $rows = $st->fetchAll();
$st = $pdo->prepare("SELECT COALESCE(SUM(amount),0) FROM payables p WHERE status = 'Unpaid' $bq"); $st->execute($bp); $open = $st->fetchColumn();
page_start('Accounts Payable'); msg($error, $ok); ?>
<p>Open payables: <strong><?= money($open) ?></strong></p>
<div class="box"><form method="POST"><input type="hidden" name="add" value="1">
    <input name="supplier_name" placeholder="Supplier" required><input name="invoice_no" placeholder="Invoice no." required><input type="number" name="po_id" placeholder="PO ID (Procurement)">
    Invoice <input type="date" name="invoice_date" value="<?= date('Y-m-d') ?>" required> Due <input type="date" name="due_date" value="<?= date('Y-m-d', strtotime('+30 days')) ?>" required>
    <input type="number" name="amount" step="0.01" min="0.01" placeholder="Amount" required>
    <select name="charge_code"><?php foreach ($charge as $c) echo '<option value="' . e($c['account_code']) . '">' . e($c['account_code'] . ' - ' . $c['account_name']) . '</option>'; ?></select>
    <button class="btn">Add purchase invoice</button></form></div>
<table><tr><th>ID</th><th>Supplier</th><th>Invoice</th><th>PO</th><th>Due</th><th class="r">Amount</th><th>Status</th><th>Action</th></tr>
<?php foreach ($rows as $r): ?><tr><td><?= $r['payable_id'] ?></td><td><?= e($r['supplier_name']) ?></td><td><?= e($r['invoice_no']) ?></td><td><?= e($r['po_id']) ?></td><td><?= e($r['due_date']) ?></td>
<td class="r"><?= money($r['amount']) ?></td><td><?= e($r['status']) ?></td><td><?php if ($r['status'] === 'Unpaid'): ?>
<form method="POST" style="margin:0"><input type="hidden" name="payable_id" value="<?= $r['payable_id'] ?>"><input type="date" name="pay_date" value="<?= date('Y-m-d') ?>" required>
<select name="pay_from"><option value="1000">Cash on Hand</option><option value="1010">Cash in Bank</option></select><button class="btn" name="pay">Pay</button></form><?php else: ?>Paid <?= e($r['paid_date']) ?><?php endif; ?></td></tr><?php endforeach; ?></table>
<?php page_end();
