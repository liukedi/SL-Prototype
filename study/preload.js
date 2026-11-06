// Warms the browser cache with the prototype's files while the participant reads the first
// pages, so the prototype (and the guide's photos) open quickly on slow connections.
// The list is what versions A and B request when they open (?reset, at Gärdet); a file
// missing here simply loads when the prototype asks for it. Failures are ignored.

const FILES = [
  'vendor/maplibre-gl/maplibre-gl.js', 'vendor/maplibre-gl/maplibre-gl.css',
  'data/stops.json', 'data/search-index.json', 'map-style.json', 'assets/hotel-room.jpg',
  'tilepacks/14/2253-1204.bin', 'tilepacks/14/2254-1204.bin', // the tiles around Gärdet
  'vendor/glyphs/Noto%20Sans%20Regular/0-255.pbf', 'vendor/glyphs/Noto%20Sans%20Bold/0-255.pbf',
  'vendor/glyphs/Noto%20Sans%20Italic/0-255.pbf',
  ...['400', '500', '600'].map((w) => `vendor/fonts/special-gothic/special-gothic-${w}-latin.woff2`),
  'css/app.css', 'css/b.css', 'css/fonts.css',
  ...['ambience', 'clock', 'config', 'departure-row', 'departures', 'device', 'favorites', 'filters-sheet',
    'journey-details', 'journeys', 'keyboard', 'map', 'routes', 'search-panel', 'sheet', 'stop-index',
    'stop-page', 'stop-search', 'store', 'tile-packs', 'time-picker', 'toast', 'travel', 'ui', 'variant'].map((f) => `js/${f}.js`),
  ...['explore', 'index', 'journey-art', 'map-center', 'map-settings', 'onboarding', 'scenic',
    'special-stations', 'station-info', 'sun', 'toast', 'tourist-mode'].map((f) => `js/b/${f}.js`),
  ...['curated-routes', 'exhibitions', 'scenic', 'special-stations', 'station-info'].map((f) => `data/b/${f}.json`),
  'assets/b/stations/credits.json',
  ...['bus', 'ferry', 'metro', 'place-dot', 'shield', 'train', 'tram', 'poi-culture', 'poi-food', 'poi-health',
    'poi-hotel', 'poi-park', 'poi-school', 'poi-shop', 'poi-sport', 'poi-worship'].map((f) => `icons/${f}.svg`),
  ...['art-hallonbergen', 'art-husby', 'art-kungstradgarden', 'art-morby-centrum', 'art-ostermalmstorg',
    'art-solna-centrum', 'art-solna-strand', 'art-stadion', 'art-t-centralen', 'art-tekniska-hogskolan',
    'art-tensta', 'art-universitetet', 'exhibition-hook', 'nature-gamla-stan', 'nature-hammarbyhojden',
    'nature-kristineberg', 'nature-ropsten', 'nature-skogskyrkogarden'].map((f) => `icons/b/${f}.png`),
].map((f) => `../${f}`);

// A few requests at a time, low priority, so the study page itself stays responsive.
export function warmCache(extra = []) {
  const queue = [...FILES, ...extra];
  const next = () => {
    const url = queue.shift();
    if (!url) return undefined;
    return fetch(url, { priority: 'low' }).then((r) => r.arrayBuffer()).catch(() => {}).then(next);
  };
  for (let i = 0; i < 4; i++) next();
}
