// Loads data/search-index.json once and shares it (search page + favourites).
import { CONFIG } from './config.js';

let promise = null;

// "My location" in Travel: the fake user position (always Gärdet, see js/config.js).
export const MY_LOCATION = Object.freeze({ name: 'My location', municipality: '', types: '', myLocation: true, lngLat: CONFIG.userLocation });

export const stopKey = (stop) => (stop.myLocation ? '@me' : `${stop.name}|${stop.municipality}`);

// Resolves to { rows: [[name, municipality, types, lng, lat], …], byKey: Map(key → stop) }
// where stop = { name, municipality, types, lngLat: [lng, lat] }
export function loadStopIndex() {
  promise ??= fetch(CONFIG.searchIndexUrl)
    .then((r) => r.json())
    .then(({ stops }) => ({
      rows: stops,
      byKey: new Map(stops.map(([name, municipality, types, lng, lat]) => [`${name}|${municipality}`, { name, municipality, types, lngLat: lng != null ? [lng, lat] : null }])),
    }));
  return promise;
}

// A stored key back to a stop object (falls back gracefully if the index changed).
export function stopFromKey(byKey, key) {
  if (key === '@me') return MY_LOCATION;
  const [name, municipality = ''] = key.split('|');
  return byKey.get(key) ?? { name, municipality, types: 'b' };
}
