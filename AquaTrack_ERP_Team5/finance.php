<?php
require_once 'includes/accounting.php';
require_role(ACC_ROLES);
if (isset($_GET['change'])) { unset($_SESSION['acc_branch']); header('Location: finance.php'); exit; }
if (isset($_GET['branch'])) { $_SESSION['acc_branch'] = max(0, (int)$_GET['branch']); header('Location: finance.php'); exit; }
$branches = $pdo->query("SELECT * FROM branches ORDER BY branch_id")->fetchAll();
$sel = $_SESSION['acc_branch'] ?? null;
page_start('Finance & Accounting', true);
if ($sel === null): ?>
<h2 class="module-title">Select Branch</h2><p class="branch-subtitle-text">Choose a branch to access its Finance &amp; Accounting modules.</p>
<div class="branch-controls-bar"><div class="branch-search-box"><i class="fa-solid fa-magnifying-glass"></i><input type="text" id="branchSearch" placeholder="Search branch..."></div><div class="branch-count" id="branchCount"></div></div>
<div class="branch-grid" id="branchGrid">
  <a class="branch-card all" data-branch="all branches consolidated" href="finance.php?branch=0"><div class="branch-icon-box"><i class="fa-solid fa-building"></i></div><div><div class="branch-name">All Branches</div><div class="branch-action">Consolidated view &rarr;</div></div></a>
  <?php foreach ($branches as $b): ?><a class="branch-card" data-branch="<?= e(strtolower($b['branch_name'])) ?>" href="finance.php?branch=<?= $b['branch_id'] ?>"><div class="branch-icon-box"><i class="fa-solid fa-location-dot"></i></div><div><div class="branch-name"><?= e($b['branch_name']) ?></div><div class="branch-action">Select this branch &rarr;</div></div></a><?php endforeach; ?>
</div>
<script>(function(){var i=document.getElementById('branchSearch'),c=document.getElementById('branchCount'),cards=document.querySelectorAll('#branchGrid .branch-card');
function f(){var q=i.value.toLowerCase().trim(),n=0,t=0;cards.forEach(function(k){var all=k.classList.contains('all'),ok=k.dataset.branch.indexOf(q)>-1;k.style.display=ok?'':'none';if(!all){t++;if(ok)n++}});c.textContent=n+' of '+t+' branches'}i.oninput=f;f()})();</script>
<?php else:
    $name = 'All Branches'; foreach ($branches as $b) if ((int)$b['branch_id'] === (int)$sel) $name = $b['branch_name'];
    $cards = [['coa.php','fa-chart-bar','Chart of Accounts'],['ledger.php','fa-book','General Ledger'],['journal.php','fa-file-lines','Journal Entries'],['ap.php','fa-credit-card','Accounts Payable'],
      ['ar.php','fa-comments-dollar','Accounts Receivable'],['bank.php','fa-piggy-bank','Cash & Bank'],['expenses.php','fa-receipt','Expenses'],['statements.php','fa-folder-open','Financial Reports'],
      ['statements.php?tab=tb','fa-scale-balanced','Trial Balance'],['statements.php?tab=is','fa-chart-line','Income Statement'],['statements.php?tab=bs','fa-file-invoice-dollar','Balance Sheet'],['dashboard.php','fa-wallet','Financial Dashboard']]; ?>
<div class="submodule-header" style="margin-bottom:12px"><a class="back-btn" href="finance.php?change=1"><i class="fa-solid fa-arrow-left"></i> Back to Branches</a></div>
<h2 class="module-title">Finance &amp; Accounting &ndash; <?= e($name) ?></h2>
<div class="module-grid"><?php foreach ($cards as $c): ?><a class="module-card" href="<?= $c[0] ?>"><div class="module-card-icon"><i class="fa-solid <?= $c[1] ?>"></i></div><div class="module-card-title"><?= e($c[2]) ?></div></a><?php endforeach; ?></div>
<?php endif; page_end();
