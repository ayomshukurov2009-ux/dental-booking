/* ═══════════════════════════════════════════════════════════════════════════
   CRM PROTECTION — blocks devtools, right-click, view-source shortcuts
   ══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'F12') { e.preventDefault(); return false; }
    if (e.ctrlKey && e.shiftKey && ['I','i','J','j','C','c'].includes(e.key)) {
      e.preventDefault(); return false;
    }
    if (e.ctrlKey && ['U','u','S','s','P','p'].includes(e.key)) {
      e.preventDefault(); return false;
    }
  });

  var devtoolsOpen = false;
  function checkDevTools() {
    var threshold = 160;
    if (
      window.outerWidth  - window.innerWidth  > threshold ||
      window.outerHeight - window.innerHeight > threshold
    ) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
        document.body.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:center;height:100vh;' +
          'font-family:sans-serif;flex-direction:column;background:#0F172A;color:#fff;">' +
          '<h1 style="font-size:60px;margin:0">🔒</h1>' +
          '<h2 style="margin:16px 0 8px">Панель заблокирована</h2>' +
          '<p style="color:#64748B">Закройте инструменты разработчика и обновите страницу</p>' +
          '</div>';
      }
    } else {
      devtoolsOpen = false;
    }
  }
  setInterval(checkDevTools, 800);

  console.log('%c⛔ CRM система — доступ ограничен', 'color:#EF4444;font-size:20px;font-weight:bold;');
  console.clear();
})();
