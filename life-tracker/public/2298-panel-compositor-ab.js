/* #2298 opt-in diagnostic only. No analytics, network, storage, private DOM reads, or app state. */
(() => {
  if (new URLSearchParams(window.location.search).get('mosaic2298Compositor') !== '1') return;
  const modes = [
    ['baseline', 'Default'],
    ['no-blur', 'No panel blur'],
    ['no-transform', 'No panel wrapper transform'],
    ['both', 'Both disabled'],
  ];
  const css = [
    "html[data-mosaic-panel-compositor='no-blur'] [data-testid='calendar-day-side-panel'],",
    "html[data-mosaic-panel-compositor='no-blur'] [data-testid='calendar-day-side-panel'] *,",
    "html[data-mosaic-panel-compositor='both'] [data-testid='calendar-day-side-panel'],",
    "html[data-mosaic-panel-compositor='both'] [data-testid='calendar-day-side-panel'] * {",
    "  -webkit-backdrop-filter: none !important;",
    "  backdrop-filter: none !important;",
    "}",
    "html[data-mosaic-panel-compositor='no-transform'] [data-testid='day-panel-motion-host'] > div,",
    "html[data-mosaic-panel-compositor='both'] [data-testid='day-panel-motion-host'] > div {",
    "  transform: none !important;",
    "  transition: none !important;",
    "}",
  ].join('\n');
  const mount = () => {
    const style = document.createElement('style');
    style.textContent = css;
    style.setAttribute('data-mosaic-2298-compositor-css', 'true');
    document.head.appendChild(style);
    const panel = document.createElement('section');
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Panel compositor comparison');
    panel.setAttribute('data-mosaic-2298-compositor-hud', 'true');
    panel.style.cssText = 'position:fixed;top:12px;left:12px;z-index:2147483640;max-width:254px;padding:10px;border:1px solid #777;border-radius:10px;background:#171b22;color:#fff;font:12px/1.35 system-ui,sans-serif;box-shadow:0 5px 22px #0007';
    const title = document.createElement('strong');
    title.textContent = 'Day View panel A/B (diagnostic)';
    panel.appendChild(title);
    const help = document.createElement('p');
    help.textContent = 'Compare the same drag in each mode. Applies only to the desktop side panel; original mode is unchanged.';
    help.style.margin = '6px 0';
    panel.appendChild(help);
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';
    panel.appendChild(controls);
    const status = document.createElement('div');
    status.setAttribute('role', 'status');
    status.style.marginTop = '6px';
    panel.appendChild(status);
    const buttons = [];
    const select = (mode) => {
      document.documentElement.setAttribute('data-mosaic-panel-compositor', mode);
      for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
      status.textContent = 'Mode: ' + modes.find(([value]) => value === mode)[1];
    };
    for (const [mode, label] of modes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.mode = mode;
      button.style.cssText = 'color:#fff;background:#333b48;border:1px solid #a0a8b5;border-radius:5px;padding:5px;cursor:pointer';
      button.addEventListener('click', () => select(mode));
      controls.appendChild(button);
      buttons.push(button);
    }
    document.body.appendChild(panel);
    select('baseline');
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, {once:true});
  } else mount();
})();