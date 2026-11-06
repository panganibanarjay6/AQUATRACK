<?php
// includes/accounting.php - shared accounting helpers used by Accounting pages, Payroll, and the API.
require_once __DIR__ . '/auth.php';
const ACC_ROLES = ['Admin', 'Accountant'];
const ACC_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

function e($s) { return htmlspecialchars((string)$s); }
function acc_branch(): int { return (int)($_SESSION['acc_branch'] ?? 0); }   // 0 = all branches
function require_acc_branch() { if (!isset($_SESSION['acc_branch'])) { header('Location: finance.php'); exit; } }
function acc_branch_sql(string $alias): array { $b = acc_branch(); return $b ? [" AND $alias.branch_id = ? ", [$b]] : ['', []]; }
function money($n) { return '₱' . number_format((float)$n, 2); }

function account_id(PDO $pdo, string $code): int {
    static $cache = [];
    if (!isset($cache[$code])) {
        $s = $pdo->prepare("SELECT account_id FROM accounts WHERE account_code = ? AND is_active = 1");
        $s->execute([$code]);
        $id = $s->fetchColumn();
        if (!$id) throw new Exception("Account $code not found or inactive.");
        $cache[$code] = (int)$id;
    }
    return $cache[$code];
}

// $lines = [[account_code, debit, credit], ...]. Rejects unbalanced entries. Returns journal_id.
function post_journal(PDO $pdo, string $date, string $ref_type, ?int $ref_id, string $desc, array $lines, ?int $branch = null): int {
    $dr = 0; $cr = 0;
    foreach ($lines as $l) { $dr += $l[1]; $cr += $l[2]; }
    if ($dr <= 0 || round($dr - $cr, 2) != 0) throw new Exception('Journal entry is not balanced (debit must equal credit).');
    $own = !$pdo->inTransaction();
    if ($own) $pdo->beginTransaction();
    try {
        $pdo->prepare("INSERT INTO journal_entries (entry_date, reference_type, reference_id, description, created_by, branch_id) VALUES (?,?,?,?,?,?)")
            ->execute([$date, $ref_type, $ref_id, $desc, $_SESSION['user_id'] ?? null, $branch ?? (acc_branch() ?: null)]);
        $jid = (int)$pdo->lastInsertId();
        $ins = $pdo->prepare("INSERT INTO journal_lines (journal_id, account_id, debit, credit) VALUES (?,?,?,?)");
        foreach ($lines as $l) $ins->execute([$jid, account_id($pdo, $l[0]), round($l[1], 2), round($l[2], 2)]);
        log_audit($pdo, 'CREATE', 'journal_entries', $jid, "$ref_type #$ref_id: $desc");
        if ($own) $pdo->commit();
        return $jid;
    } catch (Throwable $t) {
        if ($own && $pdo->inTransaction()) $pdo->rollBack();
        throw $t;
    }
}

// Employee-share government contributions per MONTH: SSS from the bracket table, PhilHealth and Pag-IBIG from contribution_settings.
function compute_contributions(PDO $pdo, float $monthly): array {
    static $set = null;
    if ($set === null) {
        $set = [];
        try { foreach ($pdo->query("SELECT setting_key, setting_value FROM contribution_settings") as $r) $set[$r['setting_key']] = (float)$r['setting_value']; } catch (Throwable $t) {}
    }
    $s = $pdo->prepare("SELECT sss_amount FROM government_contributions WHERE ? BETWEEN salary_min AND salary_max LIMIT 1");
    $s->execute([$monthly]);
    $ph_base = min(max($monthly, $set['philhealth_floor'] ?? 10000), $set['philhealth_ceiling'] ?? 100000);
    return ['sss' => (float)($s->fetchColumn() ?: 0),
            'ph' => round($ph_base * ($set['philhealth_employee_rate'] ?? 2.5) / 100, 2),
            'hd' => round(min($monthly, $set['pagibig_max_fund_salary'] ?? 10000) * ($set['pagibig_employee_rate'] ?? 2) / 100, 2)];
}

function normal_balance(string $type, float $dr, float $cr): float {
    return in_array($type, ['Asset', 'Expense']) ? $dr - $cr : $cr - $dr;
}

// Debit/credit totals per account for entries between $from (optional) and $to.
function account_totals(PDO $pdo, ?string $from, string $to): array {
    $sql = "SELECT a.account_id, a.account_code, a.account_name, a.account_type, COALESCE(SUM(x.debit),0) dr, COALESCE(SUM(x.credit),0) cr
            FROM accounts a LEFT JOIN (SELECT l.account_id, l.debit, l.credit FROM journal_lines l
              JOIN journal_entries j ON j.journal_id = l.journal_id WHERE j.entry_date <= ?" . ($from ? " AND j.entry_date >= ?" : "") . (acc_branch() ? " AND j.branch_id = ?" : "") . ") x
            ON x.account_id = a.account_id GROUP BY a.account_id, a.account_code, a.account_name, a.account_type ORDER BY a.account_code";
    $s = $pdo->prepare($sql); $p = $from ? [$to, $from] : [$to]; if (acc_branch()) $p[] = acc_branch(); $s->execute($p);
    return $s->fetchAll();
}

// AP: used by ap.php and the Procurement API. Posts Dr (charge account) / Cr Accounts Payable.
function create_payable(PDO $pdo, array $d): array {
    $amount = (float)($d['amount'] ?? 0);
    $br = isset($d['branch_id']) ? (int)$d['branch_id'] : (acc_branch() ?: null);
    if (empty($d['supplier_name']) || empty($d['invoice_no']) || empty($d['invoice_date']) || empty($d['due_date']) || $amount <= 0)
        throw new Exception('Supplier, invoice no., dates, and an amount greater than 0 are required.');
    $charge = $d['charge_code'] ?? '1200';
    $pdo->beginTransaction();
    try {
        $pdo->prepare("INSERT INTO payables (supplier_id, supplier_name, po_id, invoice_no, invoice_date, due_date, amount, branch_id) VALUES (?,?,?,?,?,?,?,?)")
            ->execute([$d['supplier_id'] ?? null, $d['supplier_name'], $d['po_id'] ?? null, $d['invoice_no'], $d['invoice_date'], $d['due_date'], $amount, $br]);
        $pid = (int)$pdo->lastInsertId();
        $jid = post_journal($pdo, $d['invoice_date'], 'Payable', $pid, "Purchase invoice {$d['invoice_no']} - {$d['supplier_name']}", [[$charge, $amount, 0], ['2000', 0, $amount]], $br);
        $pdo->prepare("UPDATE payables SET journal_id = ? WHERE payable_id = ?")->execute([$jid, $pid]);
        log_audit($pdo, 'CREATE', 'payables', $pid, "Invoice {$d['invoice_no']} $amount");
        $pdo->commit();
        return [$pid, $jid];
    } catch (Throwable $t) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $t; }
}

// AR: used by ar.php and the Sales API. Posts Dr Accounts Receivable / Cr Sales Revenue.
function create_receivable(PDO $pdo, array $d): array {
    $amount = (float)($d['amount'] ?? 0);
    $br = isset($d['branch_id']) ? (int)$d['branch_id'] : (acc_branch() ?: null);
    if (empty($d['customer_name']) || empty($d['invoice_no']) || empty($d['invoice_date']) || empty($d['due_date']) || $amount <= 0)
        throw new Exception('Customer, invoice no., dates, and an amount greater than 0 are required.');
    $pdo->beginTransaction();
    try {
        $pdo->prepare("INSERT INTO receivables (customer_id, customer_name, so_id, invoice_no, invoice_date, due_date, amount, branch_id) VALUES (?,?,?,?,?,?,?,?)")
            ->execute([$d['customer_id'] ?? null, $d['customer_name'], $d['so_id'] ?? null, $d['invoice_no'], $d['invoice_date'], $d['due_date'], $amount, $br]);
        $rid = (int)$pdo->lastInsertId();
        $jid = post_journal($pdo, $d['invoice_date'], 'Receivable', $rid, "Sales invoice {$d['invoice_no']} - {$d['customer_name']}", [['1100', $amount, 0], ['4000', 0, $amount]], $br);
        $pdo->prepare("UPDATE receivables SET journal_id = ? WHERE receivable_id = ?")->execute([$jid, $rid]);
        log_audit($pdo, 'CREATE', 'receivables', $rid, "Invoice {$d['invoice_no']} $amount");
        $pdo->commit();
        return [$rid, $jid];
    } catch (Throwable $t) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $t; }
}

// Payroll -> accounting. Dr Salaries Expense (earned pay) / Cr Payroll & Contributions Payable (SSS+PhilHealth+Pag-IBIG) / Cr Cash (net pay).
function post_payroll_to_accounting(PDO $pdo, int $payroll_id): bool {
    $s = $pdo->prepare("SELECT p.*, e.branch_id FROM payroll p JOIN employees e ON e.employee_id = p.employee_id WHERE p.payroll_id = ? AND p.posted_to_accounting = 0");
    $s->execute([$payroll_id]);
    $p = $s->fetch();
    if (!$p) return false;
    $gov = $p['sss_deduction'] + $p['philhealth_deduction'] + $p['pagibig_deduction'];
    $earned = $p['basic_salary'] + $p['overtime_pay'] - $p['absence_deduction'] - $p['late_deduction'];
    $pdo->beginTransaction();
    try {
        $jid = post_journal($pdo, date('Y-m-d'), 'Payroll', $payroll_id, "Payroll {$p['period_start']} to {$p['period_end']} - employee #{$p['employee_id']}",
            [['5100', $earned, 0], ['2100', 0, $gov], ['1000', 0, $p['net_salary']]], $p['branch_id'] ? (int)$p['branch_id'] : null);
        $pdo->prepare("UPDATE payroll SET posted_to_accounting = 1, journal_id = ? WHERE payroll_id = ?")->execute([$jid, $payroll_id]);
        $pdo->commit();
        return true;
    } catch (Throwable $t) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $t; }
}

// 13th month -> accounting. Dr 13th Month Pay Expense / Cr Cash.
function post_13th_to_accounting(PDO $pdo, int $id): bool {
    $s = $pdo->prepare("SELECT t.*, e.branch_id FROM thirteenth_month_pay t JOIN employees e ON e.employee_id = t.employee_id WHERE t.thirteenth_month_id = ? AND t.posted_to_accounting = 0");
    $s->execute([$id]);
    $t = $s->fetch();
    if (!$t || $t['thirteenth_month_amount'] <= 0) return false;
    $pdo->beginTransaction();
    try {
        $jid = post_journal($pdo, date('Y-m-d'), '13thMonth', $id, "13th month pay {$t['year']} - employee #{$t['employee_id']}",
            [['5500', $t['thirteenth_month_amount'], 0], ['1000', 0, $t['thirteenth_month_amount']]], $t['branch_id'] ? (int)$t['branch_id'] : null);
        $pdo->prepare("UPDATE thirteenth_month_pay SET posted_to_accounting = 1, journal_id = ? WHERE thirteenth_month_id = ?")->execute([$jid, $id]);
        $pdo->commit();
        return true;
    } catch (Throwable $x) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $x; }
}

// Shared page layout (final UI). $hub = true for the branch / module-card pages.
function page_start(string $title, bool $hub = false) {
    global $pdo;
    $s = basename($_SERVER['SCRIPT_NAME']);
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . e($title) . ' - AquaTrack ERP</title></head><body>';
    include __DIR__ . '/nav.php';
    if ($hub) { echo '<div class="module-container">'; return; }
    $chip = '';
    $bn = function ($id) use ($pdo) { $q = $pdo->prepare("SELECT branch_name FROM branches WHERE branch_id = ?"); $q->execute([$id]); return $q->fetchColumn() ?: 'Branch'; };
    if (in_array($s, ['coa.php','journal.php','ledger.php','ap.php','ar.php','bank.php','expenses.php','statements.php']) && isset($_SESSION['acc_branch']))
        $chip = '<span class="branch-chip"><i class="fa-solid fa-location-dot"></i> ' . e($_SESSION['acc_branch'] ? $bn($_SESSION['acc_branch']) : 'All Branches') . ' <a href="finance.php?change=1">Change</a></span>';
    elseif (in_array($s, ['contributions.php','payroll_reports.php']) && !empty($_SESSION['hr_branch']))
        $chip = '<span class="branch-chip"><i class="fa-solid fa-location-dot"></i> ' . e($bn($_SESSION['hr_branch'])) . ' <a href="hr.php?change=1">Change</a></span>';
    echo '<div class="content"><h2>' . e($title) . $chip . '</h2>';
}
function page_end() { echo '</div></main></div></div></body></html>'; }
function msg(string $err, string $ok = '') {
    if ($err) echo '<div class="err">' . e($err) . '</div>';
    if ($ok) echo '<div class="ok">' . e($ok) . '</div>';
}
