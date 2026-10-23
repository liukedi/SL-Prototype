// Draggable bottom sheet with three snap points: collapsed, default, expanded.
// The sheet's top edge (pt from the phone screen's top) is exposed as the CSS variable
// --sheet-top, which also positions the locate button.
import { getScale } from './device.js';

const DRAG_THRESHOLD = 5; // px of movement before a press becomes a drag
const PROJECTION_MS = 140; // how far a flick "throws" the sheet before snapping

export function initSheet(sheet, { tabbar, onChange } = {}) {
  const root = document.documentElement;
  let snaps = {};
  let current = 'default';
  let top = 0;
  let defaultTop = null; // override for the default snap point of the home sheet (version B)

  const screen = sheet.parentElement; // the fixed 393×852 phone screen

  function computeSnaps() {
    const h = screen.clientHeight;
    // What stays visible when collapsed: the search field, or the stop page's title row.
    const header = sheet.querySelector('.stop-page:not([hidden]) .stop-page__head') ?? sheet.querySelector('.sheet__header');
    const headerBottom = header.offsetTop + header.offsetHeight;
    // A hidden tab bar (offsetParent null) leaves room down to the home indicator.
    const tabTop = tabbar && tabbar.offsetParent !== null ? tabbar.offsetTop : h - 34;
    snaps = {
      expanded: Math.round(h * 0.1),
      // Matches reference/zoom-4: sheet top at 479 of 852 pt.
      // (The override is for the home sheet only: stop pages keep the standard position.)
      default: (!sheet.classList.contains('is-stop') && defaultTop) || Math.round(h * (479 / 852)),
      // Only the search field shows above the tab bar.
      collapsed: Math.round(tabTop - headerBottom + 6),
    };
  }

  function setTop(px, animate) {
    top = px;
    sheet.classList.toggle('is-animating', !!animate);
    root.style.setProperty('--sheet-top', `${px}px`);
    onChange?.({ top: px, snap: current, height: screen.clientHeight });
  }

  function snapTo(name, animate = true) {
    current = name;
    sheet.classList.toggle('is-expanded', name === 'expanded');
    setTop(snaps[name], animate);
  }

  // --- Pointer handling (works for touch and mouse) ---
  let pointerId = null;
  let startY = 0;
  let startTop = 0;
  let dragging = false;
  let samples = [];
  let justDragged = false;

  sheet.addEventListener('pointerdown', (e) => {
    if (pointerId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pointerId = e.pointerId;
    startY = e.clientY;
    startTop = top;
    dragging = false;
    samples = [{ y: e.clientY / getScale(), t: e.timeStamp }];
  });

  // Move/up are tracked on window so a fast drag that leaves the sheet keeps working.
  window.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    const dy = (e.clientY - startY) / getScale(); // page px → screen pt
    if (!dragging) {
      if (Math.abs(dy) < DRAG_THRESHOLD) return;
      dragging = true;
    }
    const min = snaps.expanded;
    const max = snaps.collapsed;
    let next = startTop + dy;
    // Rubber-band past the outer snap points.
    if (next < min) next = min - Math.sqrt(min - next) * 2;
    if (next > max) next = max + Math.sqrt(next - max) * 2;
    setTop(next, false);
    samples.push({ y: e.clientY / getScale(), t: e.timeStamp });
    if (samples.length > 5) samples.shift();
  });

  function release(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (!dragging) return;
    dragging = false;
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 0);
    // Velocity from the last few samples (px/ms), projected forward.
    const a = samples[0];
    const b = samples[samples.length - 1];
    const v = b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;
    const projected = top + v * PROJECTION_MS;
    let best = current;
    let bestDist = Infinity;
    for (const [name, y] of Object.entries(snaps)) {
      const d = Math.abs(projected - y);
      if (d < bestDist) { bestDist = d; best = name; }
    }
    snapTo(best);
  }
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  // Swallow the click that ends a drag so rows don't activate.
  sheet.addEventListener('click', (e) => {
    if (justDragged) e.stopPropagation();
  }, true);

  const relayout = () => { computeSnaps(); snapTo(current, false); };
  window.addEventListener('resize', relayout);
  window.visualViewport?.addEventListener('resize', relayout);

  computeSnaps();
  snapTo('default', false);

  return {
    snapTo,
    // Re-measure after the sheet's content changed (e.g. stop page opened / closed).
    refresh: () => computeSnaps(),
    // Moves the default snap point (pt from the screen top; null = the standard one).
    setDefaultTop(px) {
      defaultTop = px;
      computeSnaps();
      if (current === 'default') snapTo('default');
    },
    get snap() { return current; },
    get snaps() { return { ...snaps }; },
  };
}
