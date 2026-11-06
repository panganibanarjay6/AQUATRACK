<?php
require_once 'includes/accounting.php';
require_role(['Admin', 'HR Staff', 'Payroll Staff']);
$locked = is_branch_locked();
if ($locked) $_SESSION['hr_branch'] = current_branch_id();
if (isset($_GET['change']) && !$locked) { unset($_SESSION['hr_branch']); header('Location: hr.php'); exit; }
if (isset($_GET['branch']) && !$locked) { $_SESSION['hr_branch'] = max(0, (int)$_GET['branch']); header('Location: hr.php'); exit; }
$branches = $pdo->query("SELECT * FROM branches ORDER BY branch_id")->fetchAll();
$sel = $_SESSION['hr_branch'] ?? null;
page_start('HR & Payroll', true);
if ($sel === null): ?>
<h2 class="module-title">Select Branch</h2><p class="branch-subtitle-text">Choose a branch to access its HR &amp; Payroll modules.</p>
<div class="branch-controls-bar"><div class="branch-search-box"><i class="fa-solid fa-magnifying-glass"></i><input type="text" id="branchSearch" placeholder="Search branch..."></div><div class="branch-count" id="branchCount"></div></div>
<div class="branch-grid" id="branchGrid">
  <a class="branch-card all" data-branch="all branches company wide" href="hr.php?branch=0"><div class="branch-icon-box"><i class="fa-solid fa-building"></i></div><div><div class="branch-name">All Branches</div><div class="branch-action">Company-wide &rarr;</div></div></a>
  <?php foreach ($branches as $b): ?><a class="branch-card" data-branch="<?= e(strtolower($b['branch_name'])) ?>" href="hr.php?branch=<?= $b['branch_id'] ?>"><div class="branch-icon-box"><i class="fa-solid fa-location-dot"></i></div><div><div class="branch-name"><?= e($b['branch_name']) ?></div><div class="branch-action">Select this branch &rarr;</div></div></a><?php endforeach; ?>
</div>
<script>(function(){var i=document.getElementById('branchSearch'),c=document.getElementById('branchCount'),cards=document.querySelectorAll('#branchGrid .branch-card');
function f(){var q=i.value.toLowerCase().trim(),n=0,t=0;cards.forEach(function(k){var all=k.classList.contains('all'),ok=k.dataset.branch.indexOf(q)>-1;k.style.display=ok?'':'none';if(!all){t++;if(ok)n++}});c.textContent=n+' of '+t+' branches'}i.oninput=f;f()})();</script>
<?php else:
    $name = 'All Branches'; foreach ($branches as $b) if ((int)$b['branch_id'] === (int)$sel) $name = $b['branch_name'];
    $cards = [['employees.php','fa-user-tie','Employee Management'],['attendance.php','fa-calendar-check','Attendance Management'],['payroll.php','fa-money-check-dollar','Payroll Management'],['leave.php','fa-calendar-days','Leave Management'],
      ['contributions.php','fa-hand-holding-dollar','Salary and Benefits (SSS, PhilHealth, Pag-IBIG)'],['thirteenth_month.php','fa-gift','13th Month Pay'],['payroll_reports.php','fa-file-invoice-dollar','Payroll Reports'],['reports.php','fa-file-waveform','HR Reports']]; ?>
<?php if (!$locked): ?><div class="submodule-header" style="margin-bottom:12px"><a class="back-btn" href="hr.php?change=1"><i class="fa-solid fa-arrow-left"></i> Back to Branches</a></div><?php endif; ?>
<h2 class="module-title">HR &amp; Payroll &ndash; <?= e($name) ?></h2>
<div class="module-grid"><?php foreach ($cards as $c): ?><a class="module-card" href="<?= $c[0] ?>"><div class="module-card-icon"><i class="fa-solid <?= $c[1] ?>"></i></div><div class="module-card-title"><?= e($c[2]) ?></div></a><?php endforeach; ?></div>
<?php endif; page_end();
