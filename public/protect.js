/* ═══════════════════════════════════════════════════════════════════════════
   SITE PROTECTION — blocks devtools, right-click, view-source shortcuts
   ══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── 1. Disable right-click context menu ─────────────────────────────────
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
  });

  // ── 2. Block keyboard shortcuts ─────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    // F12
    if (e.key === 'F12') { e.preventDefault(); return false; }
    // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (DevTools)
    if (e.ctrlKey && e.shiftKey && ['I','i','J','j','C','c'].includes(e.key)) {
      e.preventDefault(); return false;
    }
    // Ctrl+U (View Source)
    if (e.ctrlKey && ['U','u'].includes(e.key)) {
      e.preventDefault(); return false;
    }
    // Ctrl+S (Save page)
    if (e.ctrlKey && ['S','s'].includes(e.key)) {
      e.preventDefault(); return false;
    }
    // Ctrl+P (Print / can expose layout)
    if (e.ctrlKey && ['P','p'].includes(e.key)) {
      e.preventDefault(); return false;
    }
  });

  // ── 3. Devtools size detection (redirect if opened) ──────────────────────
  var devtoolsOpen = false;

  function checkDevTools() {
    var threshold = 160;
    var widthDiff  = window.outerWidth  - window.innerWidth;
    var heightDiff = window.outerHeight - window.innerHeight;

    if (widthDiff > threshold || heightDiff > threshold) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
        document.body.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;flex-direction:column;background:#0D1B2E;color:#fff;">' +
          '<h1 style="font-size:60px;margin-bottom:0">🔒</h1>' +
          '<h2 style="margin:16px 0 8px">Доступ закрыт</h2>' +
          '<p style="color:#94A3B8">Инструменты разработчика отключены</p>' +
          '</div>';
      }
    } else {
      devtoolsOpen = false;
    }
  }

  setInterval(checkDevTools, 1000);

  // ── 4. Console warning ────────────────────────────────────────────────────
  var warningStyle = 'color: #EF4444; font-size: 24px; font-weight: bold;';
  var warningStyle2 = 'color: #94A3B8; font-size: 14px;';
  console.log('%c⛔ СТОП!', warningStyle);
  console.log('%cЭта консоль предназначена только для разработчиков.\nЕсли кто-то попросил вас что-то сюда вставить — это мошенники.', warningStyle2);
  console.clear();

})();
