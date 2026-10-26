// Version B: art stations get an "Information" tab on their stop page (the departures move
// to "Time Table"): a one-line description, a square photo with a 360° button, the metro
// lines, Duration, Complexity, "What to look for" (from the thesis Notion page) and DISCOVER.
// The 360° view isn't built (5 s message); DISCOVER opens the station's page once
// discoverUrl is set in data/b/station-info.json.
// Rotating-exhibition stations get the same tabs: the current exhibition's photo (no frame,
// no 360°), its run instead of Complexity, and "About the exhibition" instead of the tip
// (data/b/exhibitions.json).
// Scenic-view stations: the view's photo, the walk from the station (time · distance), the
// best time (sunset computed for the scenario day; a note when it's already dark), "How to get
// there" and "Show walking route" (js/b/scenic.js draws and fits it on the map).
// Also: the selected special station is shown on the map as a white label (icon + name).
/* global maplibregl */
import { setStopInfoProvider } from '../stop-page.js';
import { stopKey } from '../stop-index.js';
import { esc, lineBadgeHtml } from '../departure-row.js';
import { lineColor } from '../departures.js';
import { showToast, NOT_BUILT } from './toast.js';
import { touristMode } from './tourist-mode.js';
import { sunset, stockholmHHMM, minutesOf } from './sun.js';
import { now as clockNow } from '../clock.js';

const INFO_URL = './data/b/station-info.json';
const CREDITS_URL = './assets/b/stations/credits.json';
const SPECIAL_URL = './data/b/special-stations.json';
const EXHIBITIONS_URL = './data/b/exhibitions.json';
const SCENIC_URL = './data/b/scenic.json';
const COMPLEXITY = {
  1: { label: 'Easy', color: '#5ed16a' },
  2: { label: 'Medium', color: '#f2b544' },
  3: { label: 'Complex', color: '#ff6a5a' },
};
const ICON_360 = '<svg width="26" height="18" viewBox="0 0 26 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="13" cy="9" rx="11" ry="4.6"/><path d="M10.5 3.2 13 1l-1.7 3.2M15.5 14.8 13 17l1.7-3.2"/></svg>';
const EYE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const FRAME = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5 8.5 6h7z"/><rect x="3" y="6" width="18" height="14.5" rx="2"/><path d="m6 17 4-4.5 3 3 2-2 3 3.5" stroke-linecap="round"/></svg>';
const PIN = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>';
const WALK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13" cy="4.5" r="2"/><path d="m9 21 2.5-6 2.5 2.5V22M8 11l3-3.5h3l2.5 4H19M11 7.5 10 13"/></svg>';
const ARROW = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9 9 3M4 3h5v5"/></svg>';

// Filled dots from the right: easy ○○●, medium ○●●, complex ●●● (as in the Stadion design).
const dots = (level, color) =>
  [1, 2, 3].map((i) => `<span class="si-dot${i > 3 - level ? ' is-on' : ''}" style="--c:${color}"></span>`).join('');

export async function addStationInfo(app) {
  const [{ stations: info }, credits, { stations: special }, { stations: exhibitions }, { stations: scenic }] = await Promise.all([
    fetch(INFO_URL).then((r) => r.json()),
    fetch(CREDITS_URL).then((r) => r.json()).catch(() => ({})),
    fetch(SPECIAL_URL).then((r) => r.json()),
    fetch(EXHIBITIONS_URL).then((r) => r.json()),
    fetch(SCENIC_URL).then((r) => r.json()),
  ]);
  const linesHtml = (lines) => (lines?.length
    ? `<div class="si__fact"><span class="si__label">Line</span><span class="si__lines">${lines.map((l) => lineBadgeHtml({ mode: 'metro', line: l, color: lineColor('metro', l) })).join('')}</span></div>`
    : '');
  const iconOf = Object.fromEntries(special.map((s) => [s.key, s.icon ?? 'special-generic.png']));
  const categoryOf = Object.fromEntries(special.map((s) => [s.key, s.category]));

  // ---- Information tab ----
  const exhibitionHtml = (stop, x) => `
        <div class="si" data-key="${esc(stopKey(stop))}">
          <p class="si__desc">${esc(x.description)}</p>
          <div class="si__row">
            <div class="si__photo si__photo--plain">
              <img src="assets/b/exhibitions/${esc(x.photo)}" alt="${esc(x.title)} by ${esc(x.artist)}" title="${esc(x.credit)}">
            </div>
            <div class="si__facts">
              ${linesHtml(x.lines)}
              <div class="si__fact"><span class="si__label" style="color:#3fb5e8">Duration</span><span>${esc(x.duration)}</span></div>
              <div class="si__fact"><span class="si__label" style="color:#c5ec6f">On view</span><span class="si__period">${esc(x.period)}</span></div>
            </div>
          </div>
          <div class="si__tip si__tip--exhibition">${FRAME}<div><b>About the exhibition</b>
            <p class="si__exh-title">${esc(x.title)} <span>· ${esc(x.artist)}</span></p>
            <p>${esc(x.about)}</p></div></div>
          <button type="button" class="si__discover" data-si="discover">DISCOVER ${ARROW}</button>
        </div>`;

  // Best time + (after dark) a note, for the scenario clock's day and time.
  function bestTime(v) {
    const t = clockNow();
    const set = sunset(v.viewpointLngLat, t);
    const setHHMM = set ? stockholmHHMM(set) : null;
    const dark = set && minutesOf(`${t.getHours()}:${t.getMinutes()}`) > minutesOf(setHHMM) + 20;
    if (v.best === 'sunset') return { label: `Sunset · ${setHHMM}`, note: dark ? `Sunset was at ${setHHMM}. Come back tomorrow before then.` : '' };
    if (v.best === 'daylight') return { label: `Daylight`, note: dark ? `It’s dark now (sunset ${setHHMM}). The view is best in daylight.` : '' };
    return { label: 'Any time', note: '' };
  }
  const MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
  const scenicHtml = (stop, v) => {
    const b = bestTime(v);
    const walkText = `${v.walk.minutes} min · ${v.walk.meters >= 1000 ? `${(v.walk.meters / 1000).toFixed(1)} km` : `${v.walk.meters} m`}`;
    return `
        <div class="si" data-key="${esc(stopKey(stop))}">
          <p class="si__desc">${esc(v.description)}</p>
          <div class="si__row">
            <div class="si__photo si__photo--plain">
              <img src="assets/b/scenic/${esc(v.photo)}" alt="View near ${esc(stop.name)}" title="${esc(v.credit)}">
            </div>
            <div class="si__facts">
              ${linesHtml(v.lines)}
              <div class="si__fact"><span class="si__label" style="color:#3fb5e8">Walk</span><span>${esc(walkText)}</span></div>
              <div class="si__fact"><span class="si__label" style="color:#f2b544">Best time</span><span>${esc(b.label)}</span></div>
            </div>
          </div>
          ${b.note ? `<p class="si__note">${MOON}<span>${esc(b.note)}</span></p>` : ''}
          <div class="si__tip si__tip--scenic">${PIN}<div><b>How to get there</b>
            <ol class="si__steps">${v.steps.map((st) => `<li>${esc(st)}</li>`).join('')}</ol>
            <p class="si__stay">Viewpoint: ${esc(v.viewpoint)} · stay ${esc(v.stay)}</p></div></div>
          <button type="button" class="si__walk" data-si="walk">${WALK} Show walking route</button>
          <button type="button" class="si__discover si__discover--secondary" data-si="discover">DISCOVER ${ARROW}</button>
        </div>`;
  };

  setStopInfoProvider((stop) => {
    if (!touristMode.on) return null; // Tourist Mode off: the usual stop page
    const v = scenic[stopKey(stop)];
    if (v) return { html: scenicHtml(stop, v) };
    const x = exhibitions[stopKey(stop)];
    if (x) return { html: exhibitionHtml(stop, x) };
    const d = info[stopKey(stop)];
    if (!d) return null; // not an art station: the usual stop page
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
              ${linesHtml(d.lines)}
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
    if (action === 'walk') return document.dispatchEvent(new CustomEvent('b:show-walk', { detail: key }));
    const url = (info[key] ?? exhibitions[key] ?? scenic[key])?.discoverUrl;
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
