document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); }, vp = document.querySelector('.content-viewport');
  var hub = vp && vp.querySelector('.module-container'), plain = /(dashboard)\.php$/.test(location.pathname);
  var c = vp && vp.querySelector('.content');
  if (c && !plain && !hub && !c.querySelector('.submodule-header')) {
    var b = document.createElement('div'); b.className = 'submodule-header'; b.style.marginBottom = '14px';
    b.innerHTML = '<a class="back-btn" href="javascript:history.back()"><i class="fa-solid fa-arrow-left"></i> Back</a><span class="crumb">Dashboard › ' + document.title.split(' - ')[0] + '</span>';
    c.prepend(b);
  }
  var s = $('searchInput'), x = $('clearSearch');
  function run() {
    var q = s.value.toLowerCase(); x.style.display = q ? 'block' : 'none';
    document.querySelectorAll('.module-card,.branch-card').forEach(function (t) { t.style.display = t.textContent.toLowerCase().indexOf(q) > -1 ? '' : 'none'; });
    document.querySelectorAll('.content table').forEach(function (t) {
      if (t.querySelector('[rowspan]')) return;
      Array.prototype.forEach.call(t.rows, function (r) { if (r.querySelector('th')) return; r.style.display = r.textContent.toLowerCase().indexOf(q) > -1 ? '' : 'none'; });
    });
  }
  if (s) { s.oninput = run; x.onclick = function () { s.value = ''; run(); s.focus(); }; }
  var t = $('themeToggle');
  function icon() { if (t) t.firstElementChild.className = document.body.classList.contains('dark-mode') ? 'fa-regular fa-sun' : 'fa-regular fa-moon'; }
  if (t) { t.onclick = function () { document.body.classList.toggle('dark-mode'); localStorage.aqdark = document.body.classList.contains('dark-mode') ? '1' : '0'; icon(); }; icon(); }
  var bell = $('bell'); if (bell) bell.onclick = function (e) { e.stopPropagation(); $('notes').classList.toggle('show'); };
  document.addEventListener('click', function () { var n = $('notes'); if (n) n.classList.remove('show'); });
  var m = $('menuBtn'); if (m) m.onclick = function (e) { e.stopPropagation(); document.body.classList.toggle('navopen'); };
});
