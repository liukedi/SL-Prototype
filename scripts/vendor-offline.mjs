// Makes the prototype self-contained (no third-party servers at run time), so it also loads
// where Google Fonts, unpkg or OpenFreeMap are blocked or slow (e.g. mainland China).
// Downloads, once:
//   1. MapLibre GL JS + CSS            → vendor/maplibre-gl/
//   2. Special Gothic (Google Fonts)    → vendor/fonts/special-gothic/ + css/fonts.css
//   3. Map tiles for the Stockholm area → tiles/{z}/{x}/{y}.pbf  (OpenFreeMap, OpenMapTiles schema)
//      and the label glyphs            → vendor/glyphs/{fontstack}/{range}.pbf
// Usage: node scripts/vendor-offline.mjs [--only=maplibre,fonts,tiles,glyphs]
// Re-running skips files that already exist.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// (fileURLToPath, not URL.pathname: the project folder name has a space.)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAPLIBRE = '4.7.1';
// Map areas (west, south, east, north), keep in step with map-style.json → sources.bounds:
//   - SL's whole area (Stockholm County) up to zoom 12: towns, roads, water everywhere;
//   - the dense core (metro, commuter rail, trams: Upplands Väsby – Södertälje, Ekerö – Lidingö /
//     Nacka) up to zoom 14, full detail;
//   - outside the core, zoom 13–14 around every stop (data/stops.geojson: the stop's tile and
//     its 8 neighbours), so wherever there is transit the map has full detail. Elsewhere at zoom
//     13+ (forest, sea between towns) the map shows only its background colour.
export const TIERS = [
  { bbox: [17.24, 58.74, 19.17, 60.21], minZoom: 0, maxZoom: 12 },
  { bbox: [17.55, 59.10, 18.55, 59.62], minZoom: 13, maxZoom: 14 },
];
const MAX_ZOOM = 14; // OpenMapTiles data stops at 14; MapLibre over-zooms beyond
const AROUND_STOPS = { minZoom: 13, maxZoom: 14, ring: 1 };
const GLYPH_STACKS = ['Noto Sans Regular', 'Noto Sans Italic', 'Noto Sans Bold'];
const GLYPH_RANGES = [0, 256, 512, 768, 8192]; // Latin, Latin-1, Latin Extended A/B, punctuation (– ’ …)
const UA = { 'User-Agent': 'SL-prototype-research/1.0 (offline copy for a thesis user study)' };
const CHROME_UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };

const only = (process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'maplibre,fonts,tiles,glyphs').split(',');
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
async function get(url, headers = UA, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers });
      if (r.status === 404 || r.status === 204) return null;
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((res) => setTimeout(res, 800 * i));
    }
  }
}

async function maplibre() {
  for (const f of ['maplibre-gl.js', 'maplibre-gl.css']) {
    const out = path.join(ROOT, 'vendor/maplibre-gl', f);
    if (fs.existsSync(out)) continue;
    write(out, await get(`https://unpkg.com/maplibre-gl@${MAPLIBRE}/dist/${f}`));
  }
  console.log('maplibre: ok');
}

async function fonts() {
  const css = (await get('https://fonts.googleapis.com/css2?family=Special+Gothic:wght@400;500;600;700&display=swap', CHROME_UA)).toString();
  // Google's CSS: "/* latin-ext */ @font-face { … }" for each subset and weight.
  const blocks = [...css.matchAll(/\/\* ([\w-]+) \*\/\s*@font-face\s*(\{[^}]*\})/g)];
  let local = '/* Special Gothic (SIL Open Font License), self-hosted: see scripts/vendor-offline.mjs */\n';
  for (const [, subset, b] of blocks) {
    if (!['latin', 'latin-ext'].includes(subset)) continue;
    const weight = b.match(/font-weight:\s*(\d+)/)[1];
    const url = b.match(/url\((https:[^)]+\.woff2)\)/)[1];
    const name = `special-gothic-${weight}-${subset}.woff2`;
    const out = path.join(ROOT, 'vendor/fonts/special-gothic', name);
    if (!fs.existsSync(out)) write(out, await get(url, CHROME_UA));
    local += `/* ${subset} */\n@font-face${b.replace(url, `../vendor/fonts/special-gothic/${name}`)}`;
  }
  write(path.join(ROOT, 'css/fonts.css'), local);
  console.log('fonts: ok', blocks.length, 'faces in Google CSS');
}

const lng2x = (lng, z) => Math.floor(((lng + 180) / 360) * 2 ** z);
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

async function tiles() {
  const tj = JSON.parse((await get('https://tiles.openfreemap.org/planet')).toString());
  const tmpl = tj.tiles[0];
  const jobs = [];
  for (const { bbox, minZoom, maxZoom } of TIERS) {
    for (let z = minZoom; z <= maxZoom; z++) {
      const [x0, x1] = [lng2x(bbox[0], z), lng2x(bbox[2], z)];
      const [y0, y1] = [lat2y(bbox[3], z), lat2y(bbox[1], z)];
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push([z, x, y]);
    }
  }
  const stops = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/stops.geojson'), 'utf8')).features;
  const seenJob = new Set(jobs.map((j) => j.join('/')));
  for (let z = AROUND_STOPS.minZoom; z <= AROUND_STOPS.maxZoom; z++) {
    for (const f of stops) {
      const [lng, lat] = f.geometry.coordinates;
      const tx = lng2x(lng, z);
      const ty = lat2y(lat, z);
      for (let dx = -AROUND_STOPS.ring; dx <= AROUND_STOPS.ring; dx++) {
        for (let dy = -AROUND_STOPS.ring; dy <= AROUND_STOPS.ring; dy++) {
          const id = `${z}/${tx + dx}/${ty + dy}`;
          if (!seenJob.has(id)) { seenJob.add(id); jobs.push([z, tx + dx, ty + dy]); }
        }
      }
    }
  }
  let done = 0; let bytes = 0; let missing = 0;
  const worker = async () => {
    while (jobs.length) {
      const [z, x, y] = jobs.shift();
      const out = path.join(ROOT, `tiles/${z}/${x}/${y}.pbf`);
      if (!fs.existsSync(out)) {
        const buf = await get(tmpl.replace('{z}', z).replace('{x}', x).replace('{y}', y));
        if (buf) { write(out, buf); bytes += buf.length; } else missing++;
      }
      if (++done % 100 === 0) console.log(`tiles: ${done} (${(bytes / 1e6).toFixed(1)} MB new)`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  write(path.join(ROOT, 'tiles/README.md'), `# Map tiles (offline copy)\n\nVector tiles in the OpenMapTiles schema from [OpenFreeMap](https://openfreemap.org) (data © OpenStreetMap contributors, ODbL; © OpenMapTiles), ${TIERS.map((t) => `zoom ${t.minZoom}–${t.maxZoom} for ${t.bbox.join(', ')}`).join('; ')} (west, south, east, north); and zoom ${AROUND_STOPS.minZoom}–${AROUND_STOPS.maxZoom} around every stop in data/stops.geojson. Source: ${tmpl}. Made by scripts/vendor-offline.mjs.\n`);
  console.log(`tiles: ok, ${done} tiles, ${missing} empty, ${(bytes / 1e6).toFixed(1)} MB new`);
}

async function glyphs() {
  for (const stack of GLYPH_STACKS) {
    for (const start of GLYPH_RANGES) {
      const range = `${start}-${start + 255}`;
      const out = path.join(ROOT, 'vendor/glyphs', stack, `${range}.pbf`);
      if (fs.existsSync(out)) continue;
      const buf = await get(`https://tiles.openfreemap.org/fonts/${encodeURIComponent(stack)}/${range}.pbf`);
      if (buf) write(out, buf);
    }
  }
  console.log('glyphs: ok');
}

for (const step of only) await { maplibre, fonts, tiles, glyphs }[step]();
