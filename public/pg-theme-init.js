'use strict';

/* Applies the saved colour theme before first paint (dark by default). Loaded synchronously in <head>. */
(function () {
  var root = document.documentElement, saved = null;
  try { saved = localStorage.getItem('pg_theme'); } catch (error) { /* storage unavailable */ }
  if (saved !== 'light') root.setAttribute('data-theme', 'dark');
  window.PGTheme = {
    get: function () { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; },
    set: function (theme) {
      if (theme === 'dark') root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
      try { localStorage.setItem('pg_theme', theme === 'dark' ? 'dark' : 'light'); } catch (error) { /* ignore */ }
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', theme === 'dark' ? '#0c0e1b' : '#f6f6f0');
    },
    toggle: function () { this.set(this.get() === 'dark' ? 'light' : 'dark'); return this.get(); }
  };
}());
