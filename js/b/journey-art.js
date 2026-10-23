// Version B: art stations on journey details (Tourist Mode on).
//   - Their icon after the station name (boarding / alighting stations and "Show N stops").
//   - "N art stations" next to the time and transfers.
//   - The full-screen route map shows their icon instead of the plain stop dot.
// Special stations are matched by name and position (a bus stop with the same name
// elsewhere doesn't count).
import { setJourneyDecorator } from '../journey-details.js';
import { loadStopIndex } from '../stop-index.js';
import { esc } from '../departure-row.js';
import { touristMode } from './tourist-mode.js';

const DATA_URL = './data/b/special-stations.json';
const GENERIC_ICON = 'special-generic.png';
const MAX_KM = 0.5;
const ART_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="19" height="16" rx="2.5"/><path d="m3 17 5.5-5.5 4 4 2.5-2.5L21 19" stroke-linecap="round"/><circle cx="16" cy="8.8" r="1.6" fill="currentColor" stroke="none"/></svg>';

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

export async function addJourneyArt() {
  const [{ stations }, { byKey }] = await Promise.all([fetch(DATA_URL).then((r) => r.json()), loadStopIndex()]);
  const byName = new Map();
  for (const s of stations) {
    const stop = byKey.get(s.key);
    if (stop?.lngLat) byName.set(stop.name, { icon: s.icon ?? GENERIC_ICON, lngLat: stop.lngLat });
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
    routeMap(routeMap, j) {
      if (!touristMode.on) return null;
      const map = routeMap.map;
      const found = onRoute(j);
      if (!found.size) return null;
      const names = [...found.keys()];
      const features = [...found].map(([name, s]) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: s.lngLat },
        properties: { name, icon: `b-${s.icon}` },
      }));
      Promise.all([...new Set(features.map((f) => f.properties.icon))].map(async (id) => {
        const img = await loadImage(`icons/b/${id.slice(2)}`);
        if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 3 });
      })).catch((err) => console.error('journey art icons', err));

      map.addSource('route-art', { type: 'geojson', data: { type: 'FeatureCollection', features } });
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
      // The route's own dots / end circles at these stations step aside for the icon.
      const notArt = ['!', ['in', ['get', 'name'], ['literal', names]]];
      const original = Object.fromEntries(['route-dots', 'route-ends', 'route-ends-core'].map((id) => [id, map.getFilter(id)]));
      return {
        setFullscreen(on) {
          map.setLayoutProperty('route-art', 'visibility', on ? 'visible' : 'none');
          for (const [id, f] of Object.entries(original)) map.setFilter(id, on ? ['all', f, notArt] : f);
        },
      };
    },
  });
}
