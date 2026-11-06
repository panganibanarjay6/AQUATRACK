<?php
global $pdo;
$r = $_SESSION['role'] ?? ''; $cur = basename($_SERVER['SCRIPT_NAME']); $m = $_GET['m'] ?? '';
$is_acc = in_array($r, ['Admin', 'Accountant']); $is_hr = in_array($r, ['Admin', 'HR Staff', 'Payroll Staff']);
$FIN = ['finance.php','coa.php','journal.php','ledger.php','ap.php','ar.php','bank.php','expenses.php','statements.php'];
$HRF = ['hr.php','employees.php','employee_profile.php','attendance.php','leave.php','payroll.php','thirteenth_month.php','contributions.php','payroll_reports.php','payslip.php'];
if (!function_exists('nav_item')) { function nav_item($href, $icon, $label, $on) { return '<li class="' . ($on ? 'active' : '') . '"><a href="' . $href . '"><i class="fa-solid ' . $icon . '"></i><span>' . $label . '</span></a></li>'; } }
$notes = [];
try {
    if ($is_hr) { $n = (int)$pdo->query("SELECT COUNT(*) FROM leave_requests WHERE status = 'Pending'")->fetchColumn(); if ($n) $notes[] = [$n . ' pending leave request(s)', 'leave.php']; }
    if (in_array($r, ['Admin', 'Payroll Staff'])) { $n = (int)$pdo->query("SELECT COUNT(*) FROM payroll WHERE posted_to_accounting = 0")->fetchColumn(); if ($n) $notes[] = [$n . ' payroll record(s) not yet posted', 'payroll.php']; }
    if ($is_acc) { $n = (int)$pdo->query("SELECT COUNT(*) FROM payables WHERE status = 'Unpaid' AND due_date < CURDATE()")->fetchColumn(); if ($n) $notes[] = [$n . ' overdue payable(s)', 'ap.php']; }
} catch (Throwable $e) {}
$name = $_SESSION['username'] ?? ''; $ini = strtoupper(substr($name ?: 'U', 0, 2));
?>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/final.css"><script src="assets/app.js" defer></script>
<script>if (localStorage.aqdark === '1') document.body.classList.add('dark-mode');</script>
<div class="app-container">
<aside class="sidebar">
    <div class="sidebar-brand"><div class="brand-logo-box"><i class="fa-solid fa-droplet"></i></div><div class="brand-title-group"><h1>AquaTrack</h1><span class="brand-subtitle">ERP SYSTEM</span></div></div>
    <div class="sidebar-menu">
        <div class="menu-section"><span class="menu-header">MAIN</span><ul><?= nav_item('dashboard.php', 'fa-chart-pie', 'Dashboard', $cur === 'dashboard.php') ?></ul></div>
        <div class="menu-section"><span class="menu-header">MODULES</span><ul>
            <?= nav_item('module.php?m=procurement', 'fa-boxes-stacked', 'Procurement', $m === 'procurement') . nav_item('module.php?m=inventory', 'fa-layer-group', 'Inventory', $m === 'inventory')
              . nav_item('module.php?m=production', 'fa-droplet', 'Production', $m === 'production') . nav_item('module.php?m=sales', 'fa-cart-shopping', 'Sales &amp; CRM', $m === 'sales') ?>
            <?php if ($is_acc) echo nav_item('finance.php', 'fa-wallet', 'Finance &amp; Accounting', in_array($cur, $FIN)); ?>
            <?php if ($is_hr) echo nav_item('hr.php', 'fa-users-gear', 'HR &amp; Payroll', in_array($cur, $HRF)); ?></ul></div>
        <div class="menu-section"><span class="menu-header">SYSTEM</span><ul>
            <?php if ($is_hr) echo nav_item('reports.php', 'fa-chart-line', 'Reports &amp; Analytics', $cur === 'reports.php'); elseif ($is_acc) echo nav_item('statements.php', 'fa-chart-line', 'Reports &amp; Analytics', false); ?>
            <?php if ($r === 'Admin') echo nav_item('audit_log.php', 'fa-shield-halved', 'Audit Trail', $cur === 'audit_log.php') . nav_item('users.php', 'fa-users', 'Users', $cur === 'users.php'); ?></ul></div>
    </div>
    <div class="sidebar-footer"><div class="user-avatar"><?= htmlspecialchars($ini) ?></div><div class="user-info"><span class="user-name"><?= htmlspecialchars($name) ?></span><span class="user-role"><?= strtoupper(htmlspecialchars($r)) ?></span></div>
        <a class="logout" href="logout.php" title="Log out"><i class="fa-solid fa-right-from-bracket"></i></a></div>
</aside>
<div class="main-wrapper">
<header class="top-navbar">
    <button class="icon-btn" id="menuBtn" type="button"><i class="fa-solid fa-bars"></i></button>
    <div class="search-box"><i class="fa-solid fa-magnifying-glass search-icon"></i><input type="text" id="searchInput" placeholder="Search..." autocomplete="off"><i class="fa-solid fa-xmark clear-search" id="clearSearch" style="display:none"></i></div>
    <div class="top-nav-actions">
        <div class="bellwrap"><button class="icon-btn" id="bell" type="button" title="Notifications"><i class="fa-regular fa-bell"></i><?php if ($notes): ?><em><?= count($notes) ?></em><?php endif; ?></button>
            <div class="notes" id="notes"><?php if ($notes): foreach ($notes as $n): ?><a href="<?= $n[1] ?>"><?= htmlspecialchars($n[0]) ?></a><?php endforeach; else: ?><span>No new notifications</span><?php endif; ?></div></div>
        <button class="icon-btn" id="themeToggle" type="button" title="Toggle theme"><i class="fa-regular fa-moon"></i></button>
    </div>
</header>
<main class="content-viewport">
