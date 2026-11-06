<?php
require_once 'includes/accounting.php';
require_role(ACC_ROLES);
require_acc_branch();
$error = ''; $ok = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (isset($_POST['add'])) {
            create_receivable($pdo, ['customer_name' => trim($_POST['customer_name']), 'so_id' => $_POST['so_id'] ?: null, 'invoice_no' => trim($_POST['invoice_no']),
                'invoice_date' => $_POST['invoice_date'], 'due_date' => $_POST['due_date'], 'amount' => $_POST['amount']]);
            $ok = 'Sales invoice recorded and posted to the journal.';
        } elseif (isset($_POST['collect'])) {
            $s = $pdo->prepare("SELECT * FROM receivables WHERE receivable_id = ?"); $s->execute([(int)$_POST['receivable_id']]); $r = $s->fetch();
            if (!$r) throw new Exception('Invoice not found.');
            $amt = (float)$_POST['amount']; $bal = $r['amount'] - $r['amount_paid'];
            if ($amt <= 0 || $amt > $bal + 0.001) throw new Exception('Collection must be more than 0 and not exceed the balance (' . money($bal) . ').');
            if (!in_array($_POST['method'], ['Cash', 'GCash', 'Bank transfer'])) throw new Exception('Invalid payment method.');
            $pdo->beginTransaction();
            $jid = post_journal($pdo, $_POST['col_date'], 'Collection', (int)$r['receivable_id'], "Collection from {$r['customer_name']} ({$r['invoice_no']})",
                [[$_POST['method'] === 'Cash' ? '1000' : '1010', $amt, 0], ['1100', 0, $amt]], $r['branch_id'] ? (int)$r['branch_id'] : null);
            $pdo->prepare("INSERT INTO collections (receivable_id, collection_date, amount, payment_method, journal_id) VALUES (?,?,?,?,?)")->execute([$r['receivable_id'], $_POST['col_date'], $amt, $_POST['method'], $jid]);
            $paid = $r['amount_paid'] + $amt;
            $pdo->prepare("UPDATE receivables SET amount_paid = ?, status = ? WHERE receivable_id = ?")->execute([$paid, $paid >= $r['amount'] - 0.001 ? 'Paid' : 'Partial', $r['receivable_id']]);
            log_audit($pdo, 'CREATE', 'collections', $pdo->lastInsertId(), "Collected $amt on #{$r['receivable_id']}");
            $pdo->commit(); $ok = 'Collection recorded.';
        }
    } catch (Exception $x) { if ($pdo->inTransaction()) $pdo->rollBack(); $error = $x->getMessage(); }
}
[$bq, $bp] = acc_branch_sql('r');
$st = $pdo->prepare("SELECT * FROM receivables r WHERE 1=1 $bq ORDER BY receivable_id DESC"); $st->execute($bp); $rows = $st->fetchAll();
$st = $pdo->prepare("SELECT COALESCE(SUM(amount - amount_paid),0) FROM receivables r WHERE 1=1 $bq"); $st->execute($bp); $open = $st->fetchColumn();
page_start('Accounts Receivable'); msg($error, $ok); ?>
<p>Open receivables: <strong><?= money($open) ?></strong></p>
<div class="box"><form method="POST"><input type="hidden" name="add" value="1">
    <input name="customer_name" placeholder="Customer" required><input name="invoice_no" placeholder="Invoice no." required><input type="number" name="so_id" placeholder="SO ID (Sales)">
    Invoice <input type="date" name="invoice_date" value="<?= date('Y-m-d') ?>" required> Due <input type="date" name="due_date" value="<?= date('Y-m-d', strtotime('+30 days')) ?>" required>
    <input type="number" name="amount" step="0.01" min="0.01" placeholder="Amount" required><button class="btn">Add sales invoice</button></form></div>
<table><tr><th>ID</th><th>Customer</th><th>Invoice</th><th>SO</th><th>Due</th><th class="r">Amount</th><th class="r">Paid</th><th class="r">Balance</th><th>Status</th><th>Collect</th></tr>
<?php foreach ($rows as $r): $bal = $r['amount'] - $r['amount_paid']; ?><tr><td><?= $r['receivable_id'] ?></td><td><?= e($r['customer_name']) ?></td><td><?= e($r['invoice_no']) ?></td><td><?= e($r['so_id']) ?></td><td><?= e($r['due_date']) ?></td>
<td class="r"><?= money($r['amount']) ?></td><td class="r"><?= money($r['amount_paid']) ?></td><td class="r"><?= money($bal) ?></td><td><?= e($r['status']) ?></td><td><?php if ($bal > 0.001): ?>
<form method="POST" style="margin:0"><input type="hidden" name="receivable_id" value="<?= $r['receivable_id'] ?>"><input type="date" name="col_date" value="<?= date('Y-m-d') ?>" required>
<input type="number" name="amount" step="0.01" min="0.01" max="<?= $bal ?>" value="<?= $bal ?>" required><select name="method"><option>Cash</option><option>GCash</option><option>Bank transfer</option></select>
<button class="btn" name="collect">Collect</button></form><?php else: ?>-<?php endif; ?></td></tr><?php endforeach; ?></table>
<?php page_end();
