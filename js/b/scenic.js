// Version B (Tourist Mode on): scenic-view stations on the map. When one is selected, the
// walking path from the station to its viewpoint is drawn as a dashed line with a viewpoint
// marker; "Show walking route" on its Information tab (event b:show-walk) zooms to fit both
// above the bottom sheet. Cleared when the stop page closes or Tourist Mode is switched off.
/* global maplibregl */
import { stopKey } from '../stop-index.js';
import { esc } from '../departure-row.js';
import { touristMode } from './tourist-mode.js';

const DATA_URL = './data/b/scenic.json';
const VIEW_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 19 6-9 4 6 3-4 5 7z"/><circle cx="16.5" cy="6.5" r="2"/></svg>';

export async function addScenicMap(app) {
  const { stations } = await fetch(DATA_URL).then((r) => r.json());
  const map = app.map.map;
  const empty = { type: 'FeatureCollection', features: [] };
  map.addSource('scenic-walk', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'scenic-walk-casing',
    type: 'line',
    source: 'scenic-walk',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': 'rgba(10, 20, 30, 0.55)', 'line-width': 7 },
  });
  map.addLayer({
    id: 'scenic-walk',
    type: 'line',
    source: 'scenic-walk',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': 3.5, 'line-dasharray': [0.1, 2] },
  });

  let marker = null;
  let shown = null; // key of the scenic station whose walk is drawn
  function clear() {
    marker?.remove();
    marker = null;
    shown = null;
    map.getSource('scenic-walk')?.setData(empty);
  }
  function draw(key) {
    clear();
    const s = stations[key];
    if (!s) return;
    shown = key;
    map.getSource('scenic-walk').setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: s.walk.route } }],
    });
    const el = document.createElement('div');
    el.className = 'b-viewpoint';
    el.innerHTML = `<span class="b-viewpoint__dot">${VIEW_ICON}</span><span class="b-viewpoint__name">${esc(s.viewpoint.replace(/ \(.*\)$/, ''))}</span>`;
    marker = new maplibregl.Marker({ element: el, anchor: 'top', offset: [0, -15] }).setLngLat(s.viewpointLngLat).addTo(map);
  }
  // Fit the station and the whole walk into the map area above the sheet.
  function fitWalk(key) {
    const s = stations[key];
    if (!s) return;
    if (shown !== key) draw(key);
    const coords = [...s.walk.route, s.viewpointLngLat];
    const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    // An expanded sheet leaves no map to show the route in: bring it down first.
    if (app.sheet.snap === 'expanded') app.sheet.snapTo('default');
    const top = app.sheet.snap === 'default' ? app.sheet.snaps.default
      : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-top')) || 479;
    const h = document.getElementById('screen').clientHeight;
    // fitBounds adds the map's own padding to the one given: set that to the sheet's (final)
    // height first (as js/b/map-center.js keeps it), then pass the margins only.
    map.setPadding({ top: 0, bottom: Math.max(0, h - top), left: 0, right: 0 });
    map.fitBounds(bounds, {
      padding: { top: 110, bottom: 70, left: 110, right: 110 },
      maxZoom: 16.5,
      duration: 900,
    });
  }

  document.addEventListener('sl:select-stop', (e) => {
    const key = stopKey(e.detail);
    if (touristMode.on && stations[key]) draw(key);
    else clear();
  });
  document.addEventListener('sl:close-stop', clear);
  document.addEventListener('b:show-walk', (e) => fitWalk(e.detail));
  touristMode.subscribe((on) => { if (!on) clear(); });
}
