#!/usr/bin/env node
// One-off generator for data/stops.geojson.
// Queries the Overpass API for bus stops and metro (tunnelbana) stations in the
// area between Östermalm, Gärdet, Ropsten and Mörby centrum, then writes a static
// GeoJSON file so the prototype never calls Overpass at runtime.
//
// Usage:  node scripts/fetch-stops.mjs
// Requires Node 18+ (global fetch).

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// south, west, north, east
const BBOX = [59.325, 18.02, 59.405, 18.165];
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'stops.geojson');

const bbox = BBOX.join(',');
const query = `
[out:json][timeout:60];
(
  node["highway"="bus_stop"](${bbox});
  nwr["public_transport"="platform"]["bus"="yes"](${bbox});
  nwr["station"="subway"](${bbox});
  nwr["railway"="station"]["subway"="yes"](${bbox});
);
out center tags;
`;

// The public servers are often busy: try each mirror, with exponential backoff.
async function runQuery() {
  let wait = 2000;
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            // Overpass rejects requests without an identifying User-Agent.
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

const { elements } = await runQuery();

const coordOf = (el) => (el.type === 'node' ? [el.lon, el.lat] : [el.center.lon, el.center.lat]);
const isMetro = (t) => t.station === 'subway' || (t.railway === 'station' && t.subway === 'yes');

// Rough metres between two lon/lat points (fine at this scale).
const dist = ([a, b], [c, d]) => {
  const k = Math.cos((b * Math.PI) / 180);
  return Math.hypot((a - c) * k, b - d) * 111320;
};

const features = [];
for (const el of elements) {
  const t = el.tags || {};
  if (!t.name) continue;
  const type = isMetro(t) ? 'metro' : 'bus';
  // Skip entrances / non-bus platforms that slipped through.
  if (type === 'bus' && t.railway) continue;
  const coord = coordOf(el);
  // The same physical stop is often mapped twice (bus_stop node + platform way).
  // Keep one per name per type within 20 m; opposite-direction stops stay separate.
  const dup = features.find(
    (f) => f.properties.type === type && f.properties.name === t.name && dist(f.geometry.coordinates, coord) < 20
  );
  if (dup) continue;
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coord.map((n) => +n.toFixed(6)) },
    properties: { id: `${el.type}/${el.id}`, name: t.name, type },
  });
}

// Metro stations: one point per station (OSM sometimes has node + area).
const seen = new Set();
const out = features.filter((f) => {
  if (f.properties.type !== 'metro') return true;
  if (seen.has(f.properties.name)) return false;
  seen.add(f.properties.name);
  return true;
});

const fc = {
  type: 'FeatureCollection',
  metadata: {
    source: '© OpenStreetMap contributors (ODbL), via Overpass API',
    bbox: BBOX,
    generated: new Date().toISOString(),
  },
  features: out,
};
await writeFile(OUT, JSON.stringify(fc, null, 1) + '\n');
const counts = out.reduce((m, f) => ((m[f.properties.type] = (m[f.properties.type] || 0) + 1), m), {});
console.log(`Wrote ${out.length} stops to ${OUT}`, counts);
