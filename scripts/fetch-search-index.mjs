#!/usr/bin/env node
// One-off generator for data/search-index.json: every public-transport stop name in
// Stockholm County (the SL area) with its municipality, used by the stop search.
//
// Output: { "stops": [[name, municipality, types, lng, lat], ...] }, where types is a string of
// letters: b = bus, m = metro, t = train (pendeltåg / regional), l = tram / light rail, f = ferry,
// and lng/lat is one representative point (a station if there is one, else the platform
// closest to the middle of all same-named platforms in that municipality).
//
// Usage:  node scripts/fetch-search-index.mjs      (Node 18+)
// Data © OpenStreetMap contributors (ODbL).

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'search-index.json');
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// One block per municipality: the area's tags are printed first, then its stops.
const query = `
[out:json][timeout:300];
area["name"="Stockholms län"]["admin_level"="4"]->.county;
rel(area.county)["boundary"="administrative"]["admin_level"="7"];
map_to_area->.kommuner;
foreach.kommuner->.k(
  .k out tags;
  (
    node(area.k)["highway"="bus_stop"];
    nwr(area.k)["public_transport"="station"];
    nwr(area.k)["railway"~"^(station|halt|tram_stop)$"];
    nwr(area.k)["amenity"="ferry_terminal"];
    node(area.k)["public_transport"="platform"]["ferry"="yes"];
  );
  out center tags;
);
`;

async function runQuery() {
  let wait = 3000;
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent': 'sl-map-prototype/1.0 (KTH HCI thesis research prototype)',
          },
          body: 'data=' + encodeURIComponent(query),
        });
        if (res.ok) return res.json();
        console.warn(`${url} -> ${res.status}`);
      } catch (err) {
        console.warn(`${url} -> ${err.message}`);
      }
    }
    await new Promise((r) => setTimeout(r, wait));
    wait *= 2;
  }
  throw new Error('All Overpass endpoints failed');
}

// "Stockholms kommun" -> "Stockholm", "Lidingö stad" -> "Lidingö", as shown in the SL app.
function municipalityLabel(name) {
  const base = name.replace(/\s+(kommun|stad)$/i, '');
  const genitive = {
    Stockholms: 'Stockholm', Danderyds: 'Danderyd', Österåkers: 'Österåker', Sundbybergs: 'Sundbyberg',
    Nykvarns: 'Nykvarn', Nynäshamns: 'Nynäshamn', Salems: 'Salem', Vaxholms: 'Vaxholm',
  };
  return genitive[base] ?? base;
}

function typesOf(t) {
  const s = new Set();
  if (t.highway === 'bus_stop' || t.bus === 'yes') s.add('b');
  if (t.station === 'subway' || t.subway === 'yes') s.add('m');
  if (t.station === 'light_rail' || t.railway === 'tram_stop' || t.tram === 'yes' || t.light_rail === 'yes') s.add('l');
  if (t.amenity === 'ferry_terminal' || t.ferry === 'yes') s.add('f');
  if ((t.railway === 'station' || t.railway === 'halt') && !s.has('m') && !s.has('l')) s.add('t');
  if (t.train === 'yes') s.add('t');
  return s;
}

const { elements } = await runQuery();
const byKey = new Map();
let municipality = null;
for (const el of elements) {
  const t = el.tags || {};
  if (el.type === 'area') {
    municipality = municipalityLabel(t.name);
    continue;
  }
  const name = (t.name || '').trim();
  if (!name || !municipality) continue;
  const types = typesOf(t);
  if (!types.size) continue;
  const key = `${name}\u0000${municipality}`;
  if (!byKey.has(key)) byKey.set(key, { types: new Set(), points: [], stations: [] });
  const entry = byKey.get(key);
  for (const x of types) entry.types.add(x);
  const pt = el.type === 'node' ? [el.lon, el.lat] : el.center && [el.center.lon, el.center.lat];
  if (pt) (t.public_transport === 'station' || t.railway === 'station' ? entry.stations : entry.points).push(pt);
}

// A station's point if there is one; else the platform closest to the group's centre.
function representative({ points, stations }) {
  if (stations.length) return stations[0];
  if (!points.length) return null;
  const cx = points.reduce((a, p) => a + p[0], 0) / points.length;
  const cy = points.reduce((a, p) => a + p[1], 0) / points.length;
  return points.reduce((best, p) => (Math.hypot(p[0] - cx, p[1] - cy) < Math.hypot(best[0] - cx, best[1] - cy) ? p : best));
}

const order = 'mtlfb';
const stops = [...byKey]
  .map(([key, entry]) => {
    const [name, mun] = key.split('\u0000');
    const pt = representative(entry);
    const types = [...entry.types].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join('');
    return pt ? [name, mun, types, +pt[0].toFixed(5), +pt[1].toFixed(5)] : [name, mun, types];
  })
  .sort((a, b) => a[0].localeCompare(b[0], 'sv') || a[1].localeCompare(b[1], 'sv'));

await writeFile(
  OUT,
  JSON.stringify({
    source: '© OpenStreetMap contributors (ODbL), via Overpass API',
    generated: new Date().toISOString(),
    stops,
  }) + '\n'
);
const muns = new Set(stops.map((s) => s[1]));
console.log(`Wrote ${stops.length} stops in ${muns.size} municipalities to ${OUT}`);
console.log([...muns].sort().join(', '));
