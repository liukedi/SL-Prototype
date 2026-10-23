// Map module: MapLibre GL + OpenFreeMap tiles with the custom dark style (map-style.json),
// transit stop layers and the fake user location.
// Kept independent of the UI overlay so extra layers (e.g. tourist mode) can be added later.
/* global maplibregl */
import { CONFIG } from './config.js';
import { nowMs } from './clock.js';

// Start zoom: ?z=1..4 jumps to a reference screenshot's zoom, ?zoom=15.2 to any zoom.
function initialZoom() {
  const q = new URLSearchParams(location.search);
  if (q.has('z')) return CONFIG.referenceZooms[q.get('z')] ?? CONFIG.defaultZoom;
  if (q.has('zoom')) return Number(q.get('zoom')) || CONFIG.defaultZoom;
  return CONFIG.defaultZoom;
}

// At low zoom the SL app shows one dot per stop rather than one per platform.
// Mark the first platform of each same-named group (within ~250 m) as `primary`.
function markPrimaryStops(fc) {
  const kept = [];
  for (const f of fc.features) {
    const [x, y] = f.geometry.coordinates;
    const near = kept.find(
      (k) =>
        k.properties.name === f.properties.name &&
        Math.abs(k.geometry.coordinates[0] - x) < 0.0045 &&
        Math.abs(k.geometry.coordinates[1] - y) < 0.0023
    );
    f.properties.primary = !near;
    if (!near) kept.push(f);
  }
  return fc;
}

// Blue dot with white ring and a light-blue heading cone. The position is always the
// fake one from CONFIG: the device's real location is never requested.
export function createUserLocationElement() {
  const el = document.createElement('div');
  el.className = 'user-location';
  el.innerHTML = '<div class="user-location__cone"></div><div class="user-location__dot"></div>';
  el.style.setProperty('--heading', `${CONFIG.userHeading}deg`);
  return el;
}

// Images used by the style and the stop layers. [file, pixelRatio, extra addImage options]
const ICONS = {
  'stop-bus': ['icons/bus.svg', 3],
  'stop-metro': ['icons/metro.svg', 3],
  'place-dot': ['icons/place-dot.svg', 3],
  // Stretchable shield for road refs (E20 etc.); 48x36 px image, 3 px rounded corners.
  shield: ['icons/shield.svg', 3, { stretchX: [[9, 39]], stretchY: [[9, 27]], content: [6, 6, 42, 30] }],
  'poi-shop': ['icons/poi-shop.svg', 3],
  'poi-school': ['icons/poi-school.svg', 3],
  'poi-park': ['icons/poi-park.svg', 3],
  'poi-sport': ['icons/poi-sport.svg', 3],
  'poi-hotel': ['icons/poi-hotel.svg', 3],
  'poi-health': ['icons/poi-health.svg', 3],
  'poi-culture': ['icons/poi-culture.svg', 3],
  'poi-worship': ['icons/poi-worship.svg', 3],
  'poi-food': ['icons/poi-food.svg', 3],
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

// Stop dot for mid zooms: ~6 px light-blue circle with a thin darker outline.
function drawStopDot() {
  const r = 3; // css px
  const pr = 3;
  const size = (r + 1) * 2 * pr;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.scale(pr, pr);
  ctx.beginPath();
  ctx.arc(r + 1, r + 1, r, 0, Math.PI * 2);
  ctx.fillStyle = '#8cc8f0';
  ctx.fill();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = '#24507a';
  ctx.stroke();
  return { img: ctx.getImageData(0, 0, size, size), options: { pixelRatio: pr } };
}

// Icons are shared by every map instance (main map + journey route map).
let iconsPromise = null;
const sharedIcons = () => (iconsPromise ??= preloadIcons());

function provideStyleImages(map, icons) {
  map.on('styleimagemissing', (e) => {
    const icon = icons[e.id];
    if (icon && !map.hasImage(e.id)) map.addImage(e.id, icon.img, icon.options);
  });
  map.once('load', () => {
    for (const [name, { img, options }] of Object.entries(icons)) {
      if (!map.hasImage(name)) map.addImage(name, img, options);
    }
  });
}

async function preloadIcons() {
  const entries = await Promise.all(
    Object.entries(ICONS).map(async ([name, [url, pixelRatio, opts]]) => [
      name,
      { img: await loadImage(url), options: { pixelRatio, ...opts } },
    ])
  );
  return { ...Object.fromEntries(entries), 'stop-dot': drawStopDot() };
}

function addStopLayers(map, stops) {
  map.addSource('stops', { type: 'geojson', data: stops });

  // Mid zooms: small light-blue dots. Drawn as a symbol layer so that collision
  // detection thins them out when zoomed out (zoom-2) and lets more through as you
  // zoom in (zoom-3). One platform per stop name is placed first.
  map.addLayer({
    id: 'stops-dot',
    type: 'symbol',
    source: 'stops',
    minzoom: CONFIG.stopsDotMinZoom,
    maxzoom: CONFIG.stopsIconMinZoom,
    layout: {
      'icon-image': 'stop-dot',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.85, 14, 1],
      'icon-padding': ['interpolate', ['linear'], ['zoom'], 12, 26, 13, 14, 13.6, 2],
      'symbol-sort-key': ['case', ['get', 'primary'], 0, 1],
    },
  });

  // Street level: rounded-square icons (bus glyph / T roundel).
  map.addLayer({
    id: 'stops-icon',
    type: 'symbol',
    source: 'stops',
    minzoom: CONFIG.stopsIconMinZoom,
    layout: {
      'icon-image': ['match', ['get', 'type'], 'metro', 'stop-metro', 'stop-bus'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.9, 16, 1, 18, 1.08],
      'icon-allow-overlap': true,
      // POI labels still avoid the stop icons.
      'icon-ignore-placement': false,
      'symbol-sort-key': ['match', ['get', 'type'], 'metro', 0, 1],
      'symbol-z-order': 'source',
    },
  });
}

// Camera for a focused stop: zoomed in, with the stop placed in the map area above the
// sheet (pin tip ≈ 325 pt from the top, as in the SL app).
const STOP_ZOOM = 16;
const STOP_PADDING = { top: 0, bottom: 202, left: 0, right: 0 };

// Large stop pin (rounded square with a pointer), like the selected stop in the SL app.
function createStopPinElement(iconName) {
  const el = document.createElement('div');
  el.className = 'stop-pin';
  el.innerHTML = `<img src="icons/${iconName}.svg" alt="" width="40" height="40"><span class="stop-pin__tail"></span>`;
  return el;
}

export async function createMap(container, { onStopClick } = {}) {
  const [icons, stops] = await Promise.all([
    sharedIcons(),
    fetch(CONFIG.stopsUrl).then((r) => r.json()).then(markPrimaryStops),
  ]);

  const map = new maplibregl.Map({
    container,
    style: CONFIG.styleUrl,
    center: CONFIG.userLocation,
    zoom: initialZoom(),
    minZoom: CONFIG.minZoom,
    maxZoom: CONFIG.maxZoom,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    maxPitch: 0,
    fadeDuration: 150,
  });
  map.jumpTo({ padding: CONFIG.cameraPadding });
  // Keep the map north-up: pinch zooms only, no two-finger rotation.
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();

  map.addControl(
    // OpenFreeMap's TileJSON supplies "OpenFreeMap © OpenMapTiles Data from OpenStreetMap".
    new maplibregl.AttributionControl({ compact: false }),
    'top-left'
  );

  provideStyleImages(map, icons);
  await new Promise((resolve) => map.once('load', resolve));
  addStopLayers(map, stops);
  new maplibregl.Marker({ element: createUserLocationElement(), rotationAlignment: 'viewport' })
    .setLngLat(CONFIG.userLocation)
    .addTo(map);

  // Tapping a stop on the map opens it (the caller resolves it to a stop page).
  for (const layer of ['stops-icon', 'stops-dot']) {
    map.on('click', layer, (e) => {
      const f = e.features?.[0];
      if (f) onStopClick?.({ name: f.properties.name, type: f.properties.type, lngLat: f.geometry.coordinates });
    });
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
  }

  let stopPin = null;
  // Version B: bottom inset (pt) of the visible map, so camera moves centre on the part
  // above the bottom sheet. A function returning a number, or null for the fixed paddings.
  let cameraInset = null;
  const padding = (fallback) => {
    const bottom = cameraInset?.();
    return bottom == null ? fallback : { top: 0, bottom, left: 0, right: 0 };
  };

  // Handy for tuning in the console: slMap.getZoom(), slMap.setZoom(13.3)…
  window.slMap = map;
  return {
    map,
    // Show the selected stop's pin and fly there.
    focusStop(lngLat, iconName) {
      stopPin?.remove();
      stopPin = new maplibregl.Marker({ element: createStopPinElement(iconName), anchor: 'bottom' })
        .setLngLat(lngLat)
        .addTo(map);
      map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), STOP_ZOOM), padding: padding(STOP_PADDING), duration: 900, essential: true });
    },
    setCameraInset(fn) { cameraInset = fn; },
    clearStop() {
      stopPin?.remove();
      stopPin = null;
    },
    flyToUser() {
      map.flyTo({
        center: CONFIG.userLocation,
        zoom: CONFIG.defaultZoom,
        padding: padding(CONFIG.cameraPadding),
        bearing: 0,
        duration: 900,
        essential: true,
      });
    },
  };
}

// ---------- Journey route map (journey details) ----------
// A second, lightweight map: base style + one journey's route (walks dashed, rides in the
// line colour, white dots at stops, large circles where you board / alight) + the fake
// user position. Wheel-zoom and dragging only in full screen, so the details page scrolls.
export async function createRouteMap(container, journey) {
  const icons = await sharedIcons();
  const map = new maplibregl.Map({
    container,
    style: CONFIG.styleUrl,
    center: CONFIG.userLocation,
    zoom: 12,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    maxPitch: 0,
    fadeDuration: 0,
  });
  map.touchZoomRotate.disableRotation();
  provideStyleImages(map, icons);

  const lines = [];
  const points = [];
  const walk = (a, b) => a && b && lines.push({ type: 'Feature', properties: { walk: true }, geometry: { type: 'LineString', coordinates: [a, b] } });
  walk(journey.startLngLat, journey.legs[0]?.stops[0].lngLat);
  journey.legs.forEach((leg, li) => {
    if (li > 0) walk(journey.legs[li - 1].stops.at(-1).lngLat, leg.stops[0].lngLat);
    lines.push({ type: 'Feature', properties: { color: leg.color }, geometry: { type: 'LineString', coordinates: leg.stops.map((s) => s.lngLat) } });
    leg.stops.forEach((s, i) => {
      const end = i === 0 || i === leg.stops.length - 1;
      points.push({ type: 'Feature', properties: { color: leg.color, end, name: s.name }, geometry: { type: 'Point', coordinates: s.lngLat } });
    });
  });
  walk(journey.legs.at(-1)?.stops.at(-1).lngLat, journey.endLngLat);

  await new Promise((resolve) => map.once('load', resolve));
  map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: lines } });
  map.addSource('route-stops', { type: 'geojson', data: { type: 'FeatureCollection', features: points } });
  map.addLayer({
    id: 'route-walk', type: 'line', source: 'route', filter: ['==', ['get', 'walk'], true],
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': '#c7ccd2', 'line-width': 3, 'line-dasharray': [0.1, 2] },
  });
  map.addLayer({
    id: 'route-line', type: 'line', source: 'route', filter: ['!=', ['get', 'walk'], true],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 7 },
  });
  map.addLayer({
    id: 'route-dots', type: 'circle', source: 'route-stops', filter: ['!', ['get', 'end']],
    paint: { 'circle-color': '#ffffff', 'circle-radius': 2.6 },
  });
  map.addLayer({
    id: 'route-ends', type: 'circle', source: 'route-stops', filter: ['get', 'end'],
    paint: { 'circle-color': ['get', 'color'], 'circle-radius': 9, 'circle-stroke-color': 'rgba(255,255,255,0.85)', 'circle-stroke-width': 1.5 },
  });
  map.addLayer({
    id: 'route-ends-core', type: 'circle', source: 'route-stops', filter: ['get', 'end'],
    paint: { 'circle-color': '#ffffff', 'circle-radius': 3.6 },
  });
  new maplibregl.Marker({ element: createUserLocationElement(), rotationAlignment: 'viewport' })
    .setLngLat(CONFIG.userLocation)
    .addTo(map);

  // The vehicle of the first ride, on its way to the boarding station (metro only:
  // that's where the previous station is known). Closer as departure approaches.
  const first = journey.legs[0];
  if (first?.prev) {
    const board = first.stops[0].lngLat;
    const minutesLeft = (first.dep - nowMs()) / 60000;
    const f = Math.min(0.85, Math.max(0.2, 1 - minutesLeft / 4));
    const pos = [first.prev[0] + (board[0] - first.prev[0]) * f, first.prev[1] + (board[1] - first.prev[1]) * f];
    const bearing = (Math.atan2((board[0] - pos[0]) * Math.cos((pos[1] * Math.PI) / 180), board[1] - pos[1]) * 180) / Math.PI;
    const el = document.createElement('div');
    el.className = 'vehicle';
    el.innerHTML = `<span class="vehicle__badge" style="background:${first.color}">${first.line}</span>
      <svg class="vehicle__arrow" width="22" height="22" viewBox="0 0 22 22" style="transform: rotate(${bearing}deg)" aria-hidden="true">
        <path d="M11 2 18 19l-7-4-7 4z" fill="${first.color}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, 11] }).setLngLat(pos).addTo(map);
  }

  const coords = [...lines.flatMap((f) => f.geometry.coordinates)];
  const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
  const fit = (animate) => map.fitBounds(bounds, { padding: { top: 40, bottom: 40, left: 40, right: 70 }, maxZoom: 15, duration: animate ? 600 : 0 });
  fit(false);

  const setInteractive = (on) => {
    for (const h of ['scrollZoom', 'dragPan', 'doubleClickZoom', 'touchZoomRotate']) on ? map[h].enable() : map[h].disable();
  };
  setInteractive(false);

  return {
    map,
    fit,
    setFullscreen(on) {
      setInteractive(on);
      map.resize();
      fit(true);
    },
    flyToUser() {
      map.flyTo({ center: CONFIG.userLocation, zoom: Math.max(map.getZoom(), 14.5), duration: 700 });
    },
    remove: () => map.remove(),
  };
}
