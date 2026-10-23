// Version B (Tourist Mode on): the map's centre is always the centre of the part of the
// screen above the bottom sheet, so a focused stop or the user's position is never hidden
// behind a tall sheet. Camera moves (stop focus, locate) use that area, and when the sheet
// settles at a new height the map eases so the same point stays in the visible centre.
import { CONFIG } from '../config.js';
import { touristMode } from './tourist-mode.js';

const MIN_VISIBLE = 160; // pt of map kept when the sheet is expanded

export function addMapCentering(app) {
  const map = app.map.map;
  const screen = document.getElementById('screen');
  const inset = () => {
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-top'));
    const h = screen.clientHeight;
    return Number.isFinite(top) ? Math.max(0, Math.min(h - MIN_VISIBLE, h - top)) : null;
  };
  app.map.setCameraInset(() => (touristMode.on ? inset() : null));

  function apply() {
    if (map.isMoving()) { map.once('moveend', apply); return; } // don't cut a fly-to short
    const pad = touristMode.on ? { top: 0, bottom: inset() ?? 0, left: 0, right: 0 } : CONFIG.cameraPadding;
    if (Math.abs(map.getPadding().bottom - pad.bottom) > 2) map.easeTo({ padding: pad, duration: 350 });
  }
  // --sheet-top lives in the root's style attribute: re-centre once the sheet has settled.
  let timer = 0;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(apply, 180); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  touristMode.subscribe(() => setTimeout(apply, 400));
  apply();
}
