// Version B: special stations on the map (art, rotating exhibitions, scenery).
//   - District scale (stops shown as dots): special stations are orange dots; they are
//     never thinned out, unlike the light-blue dots of ordinary stops.
//   - From SPECIAL_ICON_ZOOM (neighbourhood scale): they show their designed icon
//     (icons/b/); exhibition stations the green hanging frame; others the orange T.
//   - The ordinary metro dot / icon of these stations is hidden, so nothing doubles up.
//   - Tapping one opens its stop page.
import { CONFIG } from '../config.js';
import { loadStopIndex, stopFromKey } from '../stop-index.js';

export const SPECIAL_ORANGE = '#d99a46'; // from the orange T icon in the Figma design
const SPECIAL_ICON_ZOOM = 13.3;
const DATA_URL = './data/b/special-stations.json';
const GENERIC_ICON = 'special-generic.png';

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

export async function addSpecialStations(app) {
  const map = app.map.map;
  const [{ stations }, { byKey }] = await Promise.all([fetch(DATA_URL).then((r) => r.json()), loadStopIndex()]);

  const features = [];
  for (const s of stations) {
    const stop = byKey.get(s.key);
    if (!stop?.lngLat) { console.warn('Special station not found in index:', s.key); continue; }
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: stop.lngLat },
      properties: { key: s.key, name: stop.name, category: s.category, icon: `b-${s.icon ?? GENERIC_ICON}` },
    });
  }

  // Icons (201 px exports of 67 pt designs → pixelRatio 3).
  const files = [...new Set(stations.map((s) => s.icon ?? GENERIC_ICON))];
  await Promise.all(files.map(async (file) => {
    const img = await loadImage(`icons/b/${file}`);
    if (!map.hasImage(`b-${file}`)) map.addImage(`b-${file}`, img, { pixelRatio: 3 });
  }));

  map.addSource('special-stations', { type: 'geojson', data: { type: 'FeatureCollection', features } });

  // Hide the ordinary metro dot / icon of special stations.
  const names = features.map((f) => f.properties.name);
  const notSpecialMetro = ['!', ['all', ['==', ['get', 'type'], 'metro'], ['in', ['get', 'name'], ['literal', names]]]];
  for (const id of ['stops-dot', 'stops-icon']) map.setFilter(id, notSpecialMetro);

  map.addLayer({
    id: 'special-dot',
    type: 'circle',
    source: 'special-stations',
    minzoom: CONFIG.stopsDotMinZoom,
    maxzoom: SPECIAL_ICON_ZOOM,
    paint: {
      'circle-color': SPECIAL_ORANGE,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11.8, 3, 13.3, 3.6],
      'circle-stroke-color': '#5e3b12',
      'circle-stroke-width': 0.8,
    },
  });
  map.addLayer({
    id: 'special-icon',
    type: 'symbol',
    source: 'special-stations',
    minzoom: SPECIAL_ICON_ZOOM,
    layout: {
      'icon-image': ['get', 'icon'],
      // 67 pt designs shown at ~28 pt, growing to ~34 pt at street level.
      'icon-size': ['interpolate', ['linear'], ['zoom'], SPECIAL_ICON_ZOOM, 0.42, 16, 0.5],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });

  // Tap a special station → its stop page.
  for (const id of ['special-dot', 'special-icon']) {
    map.on('click', id, (e) => {
      const f = e.features?.[0];
      if (f) app.openStop(stopFromKey(byKey, f.properties.key));
    });
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
  }
}
