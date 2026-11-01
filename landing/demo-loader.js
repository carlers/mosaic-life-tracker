(() => {
  const host = document.querySelector('[data-demo-src]');
  if (!host || !('IntersectionObserver' in window) || matchMedia('(max-width:700px)').matches) return;
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(e => e.isIntersecting)) return;
    observer.disconnect();
    const frame = document.createElement('iframe');
    frame.title = 'Interactive Mosaic demo with fictional tasks';
    frame.src = host.dataset.demoSrc;
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer';
    host.replaceChildren(frame);
  }, {rootMargin:'450px'});
  observer.observe(host);
})();
