// Demo interactions for the RUM hands-on. The RUM Web SDK is bootstrapped
// from the inline snippet in index.html; here we only call its hooks via
// the global `cwr()` queue function (set up by the snippet).

(function () {
  'use strict';

  function appendLog(message) {
    const log = document.getElementById('log');
    if (!log) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const ts = new Date().toISOString().slice(11, 19);
    entry.textContent = '[' + ts + '] ' + message;
    log.prepend(entry);
  }

  function showPage(name) {
    document.querySelectorAll('.page').forEach(function (el) {
      el.classList.remove('active');
    });
    const target = document.getElementById('page-' + name);
    if (target) target.classList.add('active');
    if (typeof window.cwr === 'function') {
      // Virtual page view -> RUM page-view event
      window.cwr('recordPageView', '/' + name);
      appendLog('recordPageView /' + name);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('nav button[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showPage(btn.getAttribute('data-nav'));
      });
    });

    const fetchBtn = document.getElementById('btn-fetch');
    if (fetchBtn) {
      fetchBtn.addEventListener('click', function () {
        appendLog('fetch jsonplaceholder ...');
        fetch('https://jsonplaceholder.typicode.com/todos/1')
          .then(function (res) {
            return res.json();
          })
          .then(function (data) {
            appendLog('fetch ok: ' + JSON.stringify(data).slice(0, 80));
          })
          .catch(function (err) {
            appendLog('fetch failed: ' + err.message);
          });
      });
    }

    const errorBtn = document.getElementById('btn-error');
    if (errorBtn) {
      errorBtn.addEventListener('click', function () {
        appendLog('throwing demo error...');
        // Async throw so it surfaces as a window error event captured by RUM
        setTimeout(function () {
          throw new Error('aws-cw-study ch09 demo: intentional client error');
        }, 0);
      });
    }

    const customBtn = document.getElementById('btn-custom');
    if (customBtn) {
      customBtn.addEventListener('click', function () {
        if (typeof window.cwr === 'function') {
          window.cwr('recordEvent', {
            type: 'demo_custom_event',
            data: { source: 'ch09-handson', clicks: 1 },
          });
          appendLog('recordEvent demo_custom_event sent');
        } else {
          appendLog('cwr() unavailable - check SDK config');
        }
      });
    }

    appendLog('app.js initialized');
  });
})();
