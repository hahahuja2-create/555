'use strict';

(() => {
  async function checkStatus() {
    try {
      const response = await fetch('/api/maintenance', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) return;
      const status = await response.json();
      if (status.active === false) {
        if (location.pathname === '/maintenance.html') location.replace('/' + location.search + location.hash);
        else location.reload();
      }
    } catch { /* retry on the next interval */ }
  }
  checkStatus();
  setInterval(checkStatus, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkStatus(); });
})();
