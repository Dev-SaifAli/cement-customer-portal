(function () {
  try {
    var stored = window.localStorage.getItem('customer_theme');
    var preference = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    var resolved =
      preference === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : preference;
    document.documentElement.dataset.customerTheme = resolved;
    document.documentElement.style.colorScheme = resolved;
    if (window.location.pathname.indexOf('/customer') === 0) {
      document.documentElement.dataset.customerRoute = 'true';
    }
  } catch (_) {
    document.documentElement.dataset.customerTheme = 'light';
  }
})();
