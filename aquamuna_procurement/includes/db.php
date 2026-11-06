<?php
require_once __DIR__ . '/config.php';

function db(): PDO {
    static $pdo = null;
    if (!$pdo) {
        $pdo = new PDO(
            'pgsql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';sslmode=require',
            DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
    }
    return $pdo;
}

/*
 * Every collection the app keeps -> its SQL table and columns.
 * [json key, sql column, type]  types: i=int, n=decimal, s=text, t=long text, b=flag
 * Any key not listed is kept in the `extra` JSON column, so nothing the app stores is ever lost.
 */
function schema_map(): array {
    $c = [['id','id','i'],['no','doc_no','s'],['ord','order_no','s'],['cdate','created_on','s']];
    return [
        'suppliers' => ['suppliers', [['id','id','i'],['no','doc_no','s'],['cdate','created_on','s'],['name','name','s'],['contact','contact','s'],['phone','phone','s'],['email','email','s'],['address','address','s'],['status','status','s']]],
        'items'     => ['items', [['id','id','i'],['no','doc_no','s'],['cdate','created_on','s'],['name','name','s'],['cat','category','s'],['unit','unit','s'],['stock','stock','n'],['reorder','reorder_level','n']]],
        'pl'        => ['price_list', [['id','id','i'],['no','doc_no','s'],['cdate','created_on','s'],['supplier','supplier_id','i'],['item','item_id','i'],['price','price','n']]],
        'pr'        => ['purchase_requests', array_merge($c, [['item','item_id','i'],['qty','qty','n'],['dept','dept','s'],['branch','branch_id','i'],['date','req_date','s'],['status','status','s']])],
        'rfq'       => ['rfqs', array_merge($c, [['pr','pr_id','i'],['item','item_id','i'],['qty','qty','n'],['supplier','supplier_id','i'],['branch','branch_id','i'],['due','due_date','s'],['status','status','s']])],
        'quo'       => ['quotations', array_merge($c, [['rfq','rfq_id','i'],['supplier','supplier_id','i'],['item','item_id','i'],['qty','qty','n'],['price','price','n'],['branch','branch_id','i'],['status','status','s']])],
        'po'        => ['purchase_orders', array_merge($c, [['supplier','supplier_id','i'],['item','item_id','i'],['qty','qty','n'],['price','price','n'],['branch','branch_id','i'],['date','order_date','s'],['status','status','s'],['_quo','quotation_id','i']])],
        'gr'        => ['goods_receipts', array_merge($c, [['po','po_id','i'],['qty','qty','n'],['date','date_received','s'],['status','status','s'],['photo','photo','t'],['photoAt','photo_at','s'],['rider','rider','s']])],
        'inv'       => ['invoices', array_merge($c, [['po','po_id','i'],['amount','amount','n'],['due','due_date','s'],['status','status','s']])],
        'pq'        => ['payment_requests', array_merge($c, [['inv','invoice_id','i'],['amount','amount','n'],['date','req_date','s'],['status','status','s'],['reason','reason','s']])],
        'rc'        => ['payment_receipts', array_merge($c, [['pq','payment_request_id','i'],['inv','invoice_id','i'],['amount','amount','n'],['method','method','s'],['refno','reference_no','s'],['date','date_paid','s'],['status','status','s']])],
        'branches'  => ['branches', [['id','id','i'],['no','doc_no','s'],['cdate','created_on','s'],['name','name','s'],['status','status','s'],['wh','is_warehouse','b']]],
        'bs'        => ['branch_stock', [['id','id','i'],['no','doc_no','s'],['cdate','created_on','s'],['branch','branch_id','i'],['item','item_id','i'],['stock','stock','n'],['reorder','reorder_level','n']]],
        'dist'      => ['distributions', array_merge($c, [['branch','branch_id','i'],['item','item_id','i'],['qty','qty','n'],['pr','pr_id','i'],['date','date_issued','s'],['status','status','s']])],
        'msgs'      => ['messages', [['id','id','i'],['po','po_id','i'],['from','from_side','s'],['by','sender_name','s'],['u','sender_user','s'],['text','body','t'],['at','sent_at','s'],['read','is_read','b']]],
        'log'       => ['audit_log', [['id','id','i'],['ts','logged_at','s'],['act','action','s'],['t','record_type','s'],['no','doc_no','s'],['ord','order_no','s'],['text','details','t'],['by','done_by','s'],['bf','is_backfill','b']]],
    ];
}

function row_to_db(array $cols, array $r): array {
    $out = []; $known = [];
    foreach ($cols as [$k, $c, $t]) {
        $known[$k] = 1;
        if (!array_key_exists($k, $r) || $r[$k] === null) { $out[$c] = null; continue; }
        $v = $r[$k];
        if ($t === 'i')      $out[$c] = is_numeric($v) ? (int)$v : null;
        elseif ($t === 'n')  $out[$c] = is_numeric($v) ? $v + 0 : null;
        elseif ($t === 'b')  $out[$c] = $v ? 1 : 0;
        else                 $out[$c] = is_scalar($v) ? (string)$v : json_encode($v);
    }
    $extra = array_diff_key($r, $known);
    $out['extra'] = $extra ? json_encode($extra, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;
    return $out;
}

function row_from_db(array $cols, array $row): array {
    $r = [];
    foreach ($cols as [$k, $c, $t]) {
        $v = $row[$c] ?? null;
        if ($v === null) continue;
        if ($t === 'i') $r[$k] = (int)$v;
        elseif ($t === 'n') { $f = (float)$v; $r[$k] = floor($f) == $f ? (int)$f : $f; }
        elseif ($t === 'b') $r[$k] = (int)$v;
        else $r[$k] = $v;
    }
    if (!empty($row['extra'])) { $x = json_decode($row['extra']); if (is_object($x)) foreach ($x as $k => $v) if (!array_key_exists($k, $r)) $r[$k] = $v; }
    return $r;
}

/** Whole data set as the JSON object the front end works with. */
function load_state(): ?array {
    $pdo = db();
    $meta = [];
    foreach ($pdo->query('SELECT k, v FROM app_meta') as $m) $meta[$m['k']] = json_decode($m['v']);   // objects stay objects ({} must not turn into [])
    if (!$meta) return null;               // empty database -> app seeds its sample data
    $D = $meta;
    foreach (schema_map() as $key => [$tbl, $cols]) {
        $D[$key] = [];
        foreach ($pdo->query("SELECT * FROM $tbl ORDER BY sort_pos") as $row) $D[$key][] = row_from_db($cols, $row);
    }
    return $D;
}

/** Save only the collections the browser sent (changed ones). Rows are diffed by hash. */
function save_state(array $parts): void {
    $pdo = db();
    $map = schema_map();
    $pdo->beginTransaction();
    try {
        foreach ($parts as $key => $val) {
            if (!isset($map[$key])) {   // version number, counters, option lists, flags, archive snapshot
                $st = $pdo->prepare('INSERT INTO app_meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v');
                $st->execute([$key, json_encode($val, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
                continue;
            }
            [$tbl, $cols] = $map[$key];
            $have = [];
            foreach ($pdo->query("SELECT id, h FROM $tbl") as $x) $have[(int)$x['id']] = $x['h'];
            $seen = [];
            $names = array_map(fn($c) => $c[1], $cols);
            $all = array_merge($names, ['extra', 'h', 'sort_pos']);
            $sql = 'INSERT INTO ' . $tbl . ' (' . implode(',', $all) . ') VALUES (' .
                   implode(',', array_fill(0, count($all), '?')) . ') ON CONFLICT (id) DO UPDATE SET ' .
                   implode(',', array_map(fn($n) => "$n=EXCLUDED.$n", array_slice($all, 1)));
            $ins = $pdo->prepare($sql);
            foreach (array_values((array)$val) as $pos => $r) {
                $r = (array)$r;   // top level only; nested {} and [] keep their type
                if (!isset($r['id'])) continue;
                $id = (int)$r['id']; $seen[$id] = 1;
                $h = md5(json_encode($r) . '#' . $pos);
                if (isset($have[$id]) && $have[$id] === $h) continue;
                $d = row_to_db($cols, $r);
                $vals = [];
                foreach ($names as $n) $vals[] = $d[$n];
                $vals[] = $d['extra']; $vals[] = $h; $vals[] = $pos;
                $ins->execute($vals);
            }
            $gone = array_diff(array_keys($have), array_keys($seen));
            if ($gone) $pdo->exec("DELETE FROM $tbl WHERE id IN (" . implode(',', array_map('intval', $gone)) . ')');
        }
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
}