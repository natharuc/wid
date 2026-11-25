(() => {
  let theme;
  try {
    theme = localStorage.getItem('wid.theme');
  } catch {
    // A browser may block storage; theme selection still works for this page.
  }
  if (theme !== 'corporate' && theme !== 'business') {
    theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'business' : 'corporate';
  }
  document.documentElement.dataset.theme = theme;
})();
