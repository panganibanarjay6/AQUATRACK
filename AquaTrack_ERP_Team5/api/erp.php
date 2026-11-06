<?php
// api/erp.php - integration endpoint for the other teams. POST JSON + header X-API-KEY (see config/db.php).
//  ?action=purchase_invoice  (Procurement -> AP)   {supplier_id, supplier_name, po_id, invoice_no, invoice_date, due_date, amount}
//  ?action=sales_invoice     (Sales -> AR)         {customer_id, customer_name, so_id, invoice_no, invoice_date, due_date, amount}
//  ?action=production_cost   (Production -> cost) {production_id, amount, date}
//  ?action=employees         (GET, all teams)      employee master list (single source of employee_id)
require_once __DIR__ . '/../includes/accounting.php';
header('Content-Type: application/json');
$key = $_SERVER['HTTP_X_API_KEY'] ?? '';
if (!isset($_SESSION['user_id']) && !hash_equals(ERP_API_KEY, $key)) { http_response_code(401); echo json_encode(['error' => 'Unauthorized']); exit; }
$in = json_decode(file_get_contents('php://input'), true) ?: $_POST;
try {
    switch ($_GET['action'] ?? '') {
        case 'purchase_invoice':
            [$id, $jid] = create_payable($pdo, $in); echo json_encode(['payable_id' => $id, 'journal_id' => $jid]); break;
        case 'sales_invoice':
            [$id, $jid] = create_receivable($pdo, $in); echo json_encode(['receivable_id' => $id, 'journal_id' => $jid]); break;
        case 'production_cost':
            $amt = (float)($in['amount'] ?? 0); if ($amt <= 0) throw new Exception('amount must be greater than 0');
            $jid = post_journal($pdo, $in['date'] ?? date('Y-m-d'), 'Production', (int)($in['production_id'] ?? 0), 'Production cost - materials consumed', [['5000', $amt, 0], ['1200', 0, $amt]]);
            echo json_encode(['journal_id' => $jid]); break;
        case 'employees':
            echo json_encode($pdo->query("SELECT employee_id, first_name, last_name, position, department_id, branch_id FROM employees
                WHERE archived = 0 AND employment_status NOT IN ('Resigned','Terminated')")->fetchAll()); break;
        default: http_response_code(400); echo json_encode(['error' => 'Unknown action']);
    }
} catch (Exception $x) { http_response_code(422); echo json_encode(['error' => $x->getMessage()]); }
