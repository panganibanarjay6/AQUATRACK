<?php
require_once __DIR__ . '/includes/db.php';
session_start();
$user = $_SESSION['user'] ?? null;
$dbError = null; $state = null;
try { db(); if ($user) $state = load_state(); } catch (Throwable $e) { $dbError = $e->getMessage(); }
$ver = '1';
?><!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aquamuna – Procurement</title>
<link rel="icon" href="assets/logo-header.png">
<link rel="stylesheet" href="assets/style.css?v=<?= $ver ?>"></head><body>
<?php if ($dbError): ?>
<div class="lg on"><div class="lgc"><img class="lgl" src="assets/logo.png" alt="Aquamuna Water Refilling Station">
<p><b>Cannot reach the database.</b></p>
<div class="lge" style="min-height:0">Start <b>MySQL</b> in the XAMPP Control Panel and import <code>sql/schema.sql</code> in phpMyAdmin.<br><br><small><?= htmlspecialchars($dbError) ?></small></div></div></div>
</body></html>
<?php exit; endif; ?>
<?php if (!$user): ?>
<div class="lg on"><form class="lgc" id="lf" autocomplete="off"><img class="lgl" src="assets/logo.png" alt="Aquamuna Water Refilling Station"><p>Sign in to continue</p>
<label>Username</label><input id="lu" autocomplete="username" autofocus>
<label>Password</label><input id="lp" type="password" autocomplete="current-password">
<div class="lge" id="le"></div><button class="btn lgs" type="submit">Sign in</button></form></div>
<script>
document.getElementById('lf').onsubmit=async e=>{e.preventDefault();const le=document.getElementById('le');le.textContent='';
 try{const r=await fetch('api.php?a=login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({u:lu.value,p:lp.value}),credentials:'same-origin'});const j=await r.json();
  if(j.ok)location.reload();else le.textContent=j.error||'Could not sign in.'}catch(x){le.textContent='Could not reach the server.'}};
</script></body></html>
<?php exit; endif; ?>
<script>window.__USER=<?= json_encode($user) ?>;window.__D=<?= json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) ?>;</script>
<header>
<div class="brand"><img src="assets/logo-header.png" alt="Aquamuna Water Refilling Station"></div>
<div class="sbox"><svg class="si" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="q" placeholder="Search modules, orders, items..." autocomplete="off"><button class="x" id="qx" title="Clear">×</button></div>
<div class="hr"><button class="ib" title="Notifications"><svg viewBox="0 0 24 24"><path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4"/></svg></button>
<button class="ib" id="th" title="Light / dark"><svg viewBox="0 0 24 24"><path d="M20 14.500A8 8 0 0 1 9.500 4 8 8 0 1 0 20 14.500z"/></svg></button>
<div class="user"><i></i><div><b id="un"></b><small id="ur"></small></div><button class="ib" id="lo" title="Log out" onclick="logout()"><svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg></button></div></div>
</header>
<div class="shell">
<aside>
<div class="sbt"><b>Dashboard</b><button class="ib" title="Collapse menu" onclick="document.body.classList.toggle('mini')"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg></button></div>
<a data-v="dash"><span class="ic"><svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></span><span class="lb">Overview</span></a>
<a data-v="proc"><span class="ic"><svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/></svg></span><span class="lb">Procurement</span><span class="car">›</span></a><div id="nav"></div>
<a data-v="invt"><span class="ic"><svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/></svg></span><span class="lb">Inventory</span><span class="car">›</span></a><div id="inav"></div>
<a data-v="mod:production"><span class="ic"><svg viewBox="0 0 24 24"><path d="M12 3s6 6.500 6 11a6 6 0 0 1-12 0c0-4.500 6-11 6-11z"/></svg></span><span class="lb">Production</span></a>
<a data-v="mod:sales"><span class="ic"><svg viewBox="0 0 24 24"><path d="M3 4h3l2.500 11h10L21 7H7M10 20h.01M17 20h.01"/></svg></span><span class="lb">Sale &amp; CRM</span></a>
<a data-v="fin"><span class="ic"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg></span><span class="lb">Finance</span><span class="car">›</span></a><div id="fnav"></div>
<a data-v="mod:hr"><span class="ic"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.500 3-6 6-6s6 2.500 6 6M16 5a3 3 0 0 1 0 6M18 14c2 .8 3 3 3 6"/></svg></span><span class="lb">HR &amp; Payroll</span></a>
<a data-v="rep"><span class="ic"><svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg></span><span class="lb">Reports &amp; Analytics</span></a>
<a data-v="mod:audit"><span class="ic"><svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z"/></svg></span><span class="lb">Audit Trail</span></a>
<button class="rpt" onclick="nav('rep')"><span class="lb">Create Report</span></button>
</aside>
<main><div class="page" id="pg"></div></main>
</div>
<div class="modal" id="md"><form id="fm"></form></div>
<div class="rm" id="rm" onclick="if(event.target===this)closeRc()"><div class="rmw"><div id="rcpt"></div><div class="rmb"><button type="button" class="btn g" onclick="closeRc()">Close</button><button type="button" class="btn" id="rmp" onclick="print()">Print Receipt</button></div></div></div>
<script src="assets/app.js?v=<?= $ver ?>"></script></body></html>
