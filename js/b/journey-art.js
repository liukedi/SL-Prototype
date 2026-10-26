// Version B: art stations on journey details (Tourist Mode on).
//   - Their icon after the station name (boarding / alighting stations and "Show N stops").
//   - "N art stations" next to the time and transfers.
//   - The small route map marks them with orange dots; the full-screen route map shows their
//     icons, and tapping one slides up that station's page (Information / Time Table).
// Special stations are matched by name and position (a bus stop with the same name
// elsewhere doesn't count).
import { setJourneyDecorator } from '../journey-details.js';
import { loadStopIndex, stopFromKey } from '../stop-index.js';
import { initStopPage } from '../stop-page.js';
import { SPECIAL_ORANGE } from './special-stations.js';
import { esc } from '../departure-row.js';
import { touristMode } from './tourist-mode.js';

const DATA_URL = './data/b/special-stations.json';
const GENERIC_ICON = 'special-generic.png';
const MAX_KM = 0.5;
const ART_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6.4 6.6h11.2v3.6h-3.8v7.6h-3.6v-7.6H6.4z" fill="currentColor"/></svg>';

function km([lng1, lat1], [lng2, lat2]) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

// Art station icons on a route map (createRouteMap): returns { setFullscreen(on) } that
// shows / hides them, or null when the route has none. Ready once addJourneyArt has loaded.
let routeArt = null;
export const routeArtIcons = (routeMap, journey) => routeArt?.(routeMap, journey) ?? null;

export async function addJourneyArt() {
  const [{ stations }, { byKey }] = await Promise.all([fetch(DATA_URL).then((r) => r.json()), loadStopIndex()]);
  const byName = new Map();
  for (const s of stations) {
    const stop = byKey.get(s.key);
    if (stop?.lngLat) byName.set(stop.name, { key: s.key, icon: s.icon ?? GENERIC_ICON, lngLat: stop.lngLat });
  }
  const special = (stop) => {
    const s = stop && byName.get(stop.name);
    return s && stop.lngLat && km(s.lngLat, stop.lngLat) < MAX_KM ? s : null;
  };
  // Special stations on a journey, each once (a transfer station is in two rides).
  const onRoute = (j) => {
    const found = new Map();
    for (const leg of j.legs) for (const stop of leg.stops) { const s = special(stop); if (s) found.set(stop.name, s); }
    return found;
  };

  setJourneyDecorator({
    stopIcon(stop) {
      const s = touristMode.on && special(stop);
      return s ? `<img class="jd-art" src="icons/b/${esc(s.icon)}" alt="Art station">` : '';
    },
    summary(j) {
      const n = touristMode.on ? onRoute(j).size : 0;
      return n ? `<span class="jd-summary__art">${ART_ICON}${n} art station${n > 1 ? 's' : ''}</span>` : '';
    },
    routeMap: (routeMap, j) => (touristMode.on ? routeArt(routeMap, j) : null),
  });

  // ---- station page sliding up over a full-screen route map ----
  const screen = document.getElementById('screen');
  const panel = document.createElement('section');
  panel.className = 'jd-stop-sheet';
  panel.hidden = true;
  panel.innerHTML = '<div class="sheet__handle" aria-hidden="true"></div><div class="stop-page"></div>';
  screen.appendChild(panel);
  const closeStop = () => { stopPage.close(); panel.hidden = true; panel.classList.remove('is-open'); };
  const stopPage = initStopPage(panel.querySelector('.stop-page'), { onClose: closeStop });
  const openStop = (key) => {
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('is-open'));
    stopPage.open(stopFromKey(byKey, key));
  };
  document.querySelectorAll('.tabbar [data-tab]').forEach((t) => t.addEventListener('click', closeStop));
  touristMode.subscribe((on) => { if (!on) closeStop(); });

  routeArt = (routeMap, j) => {
    const map = routeMap.map;
    const found = onRoute(j);
    if (!found.size) return null;
    const names = [...found.keys()];
    const features = [...found].map(([name, s]) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: s.lngLat },
      properties: { name, key: s.key, icon: `b-${s.icon}` },
    }));
    Promise.all([...new Set(features.map((f) => f.properties.icon))].map(async (id) => {
      const img = await loadImage(`icons/b/${id.slice(2)}`);
      if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 3 });
    })).catch((err) => console.error('journey art icons', err));

    map.addSource('route-art', { type: 'geojson', data: { type: 'FeatureCollection', features } });
    // Small map: orange dots (as on the main map at district scale).
    map.addLayer({
      id: 'route-art-dot',
      type: 'circle',
      source: 'route-art',
      paint: { 'circle-color': SPECIAL_ORANGE, 'circle-radius': 5, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 },
    });
    // Full screen: the stations' icons, tappable.
    map.addLayer({
      id: 'route-art',
      type: 'symbol',
      source: 'route-art',
      layout: {
        visibility: 'none',
        'icon-image': ['get', 'icon'],
        'icon-size': 0.45, // 67 pt designs at ~30 pt
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
    let fullscreen = false;
    map.on('click', 'route-art', (e) => {
      const key = e.features?.[0]?.properties.key;
      if (fullscreen && key) openStop(key);
    });
    map.on('mouseenter', 'route-art', () => { if (fullscreen) map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'route-art', () => { map.getCanvas().style.cursor = ''; });

    // The route's own dots / end-circle cores at these stations step aside for the dot / icon.
    const notArt = ['!', ['in', ['get', 'name'], ['literal', names]]];
    const original = Object.fromEntries(['route-dots', 'route-ends', 'route-ends-core'].map((id) => [id, map.getFilter(id)]));
    const apply = () => {
      map.setLayoutProperty('route-art', 'visibility', fullscreen ? 'visible' : 'none');
      map.setLayoutProperty('route-art-dot', 'visibility', fullscreen ? 'none' : 'visible');
      for (const [id, f] of Object.entries(original)) {
        const hide = fullscreen || id !== 'route-ends'; // small map keeps the end rings around the dot
        map.setFilter(id, hide ? ['all', f, notArt] : f);
      }
    };
    apply();
    return {
      setFullscreen(on) {
        fullscreen = on;
        apply();
        if (!on) closeStop();
      },
    };
  };
}
