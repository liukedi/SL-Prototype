// Version B: art stations get an "Information" tab on their stop page (the departures move
// to "Time Table"): a one-line description, a square photo with a 360° button, the metro
// lines, Duration, Complexity, "What to look for" (from the thesis Notion page) and DISCOVER.
// The 360° view isn't built (5 s message); DISCOVER opens the station's page once
// discoverUrl is set in data/b/station-info.json.
// Also: the selected special station is shown on the map as a white label (icon + name).
/* global maplibregl */
import { setStopInfoProvider } from '../stop-page.js';
import { stopKey } from '../stop-index.js';
import { esc, lineBadgeHtml } from '../departure-row.js';
import { lineColor } from '../departures.js';
import { showToast } from './toast.js';
import { touristMode } from './tourist-mode.js';

const INFO_URL = './data/b/station-info.json';
const CREDITS_URL = './assets/b/stations/credits.json';
const SPECIAL_URL = './data/b/special-stations.json';
const NOT_BUILT = 'This feature is not available in the prototype.';
const COMPLEXITY = {
  1: { label: 'Easy', color: '#5ed16a' },
  2: { label: 'Medium', color: '#f2b544' },
  3: { label: 'Complex', color: '#ff6a5a' },
};
const ICON_360 = '<svg width="26" height="18" viewBox="0 0 26 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="13" cy="9" rx="11" ry="4.6"/><path d="M10.5 3.2 13 1l-1.7 3.2M15.5 14.8 13 17l1.7-3.2"/></svg>';
const EYE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const ARROW = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9 9 3M4 3h5v5"/></svg>';

// Filled dots from the right: easy ○○●, medium ○●●, complex ●●● (as in the Stadion design).
const dots = (level, color) =>
  [1, 2, 3].map((i) => `<span class="si-dot${i > 3 - level ? ' is-on' : ''}" style="--c:${color}"></span>`).join('');

export async function addStationInfo(app) {
  const [{ stations: info }, credits, { stations: special }] = await Promise.all([
    fetch(INFO_URL).then((r) => r.json()),
    fetch(CREDITS_URL).then((r) => r.json()).catch(() => ({})),
    fetch(SPECIAL_URL).then((r) => r.json()),
  ]);
  const iconOf = Object.fromEntries(special.map((s) => [s.key, s.icon ?? 'special-generic.png']));
  const categoryOf = Object.fromEntries(special.map((s) => [s.key, s.category]));

  // ---- Information tab ----
  setStopInfoProvider((stop) => {
    const d = info[stopKey(stop)];
    if (!d || !touristMode.on) return null; // not an art station, or Tourist Mode off: the usual stop page
    const c = COMPLEXITY[d.complexity] ?? COMPLEXITY[1];
    const credit = credits[stop.name];
    const creditText = credit ? `Photo: ${credit.author} (${credit.license}), Wikimedia Commons` : '';
    return {
      html: `
        <div class="si" data-key="${esc(stopKey(stop))}">
          <p class="si__desc">${esc(d.description)}</p>
          <div class="si__row">
            <div class="si__photo">
              <img src="assets/b/stations/${esc(d.photo)}" alt="${esc(stop.name)} station" title="${esc(creditText)}">
              <button type="button" class="si__360" data-si="360" aria-label="360° view">${ICON_360}</button>
            </div>
            <div class="si__facts">
              ${d.lines?.length ? `<div class="si__fact"><span class="si__label">Line</span><span class="si__lines">${d.lines.map((l) => lineBadgeHtml({ mode: 'metro', line: l, color: lineColor('metro', l) })).join('')}</span></div>` : ''}
              <div class="si__fact"><span class="si__label" style="color:#3fb5e8">Duration</span><span>${esc(d.duration)}</span></div>
              <div class="si__fact"><span class="si__label" style="color:${c.color}">Complexity</span><span class="si__dots" aria-label="${c.label}">${dots(d.complexity, c.color)}</span></div>
            </div>
          </div>
          ${d.tip ? `<div class="si__tip">${EYE}<div><b>What to look for</b><p>${esc(d.tip)}</p></div></div>` : ''}
          <button type="button" class="si__discover" data-si="discover">DISCOVER ${ARROW}</button>
        </div>`,
    };
  });

  document.addEventListener('click', (e) => {
    const action = e.target.closest('[data-si]')?.dataset.si;
    if (!action) return;
    if (action === '360') return showToast(NOT_BUILT);
    const key = e.target.closest('.si')?.dataset.key;
    const url = info[key]?.discoverUrl;
    if (url) window.open(url, '_blank', 'noopener');
    else showToast(NOT_BUILT);
  });

  // ---- Selected special station: white label (icon + name) instead of the plain pin ----
  const map = app.map.map;
  let label = null;
  function clearLabel() {
    label?.remove();
    label = null;
    if (map.getLayer('special-icon')) map.setFilter('special-icon', null);
  }
  document.addEventListener('sl:select-stop', (e) => {
    clearLabel();
    const stop = e.detail;
    const key = stopKey(stop);
    if (!touristMode.on || !iconOf[key] || !stop.lngLat) return;
    app.map.clearStop(); // replace the plain pin
    const el = document.createElement('div');
    // Exhibition stations (Figma "Frame 35"): a wider green frame whose hook rises above the label.
    el.className = categoryOf[key] === 'exhibition' ? 'si-pin si-pin--exhibition' : 'si-pin';
    el.innerHTML = `<img src="icons/b/${esc(iconOf[key])}" alt=""><span>${esc(stop.name)}</span>`;
    label = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(stop.lngLat).addTo(map);
    // Hide the station's own icon underneath while the label is shown.
    if (map.getLayer('special-icon')) map.setFilter('special-icon', ['!=', ['get', 'key'], key]);
  });
  document.addEventListener('sl:close-stop', clearLabel);
  touristMode.subscribe((on) => { if (!on) clearLabel(); });
}
