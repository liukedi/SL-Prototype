#!/usr/bin/env node
// One-off generator for data/stops.geojson.
// Queries the Overpass API for all public transport stops in SL's area (Stockholm County):
// bus stops, metro (tunnelbana) and commuter / local rail stations, tram and light rail
// stops, and ferry piers. Writes a static GeoJSON file so the prototype never calls
// Overpass at runtime.
//
// Usage:  node scripts/fetch-stops.mjs
// Requires Node 18+ (global fetch).

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// SL's area: Stockholm County (admin level 4).
const AREA = 'area["name"="Stockholms län"]["admin_level"="4"]->.sl;';
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'stops.geojson');

const query = `
[out:json][timeout:180];
${AREA}
(
  node["highway"="bus_stop"](area.sl);
  nwr["public_transport"="platform"]["bus"="yes"](area.sl);
  nwr["station"="subway"](area.sl);
  nwr["railway"="station"]["subway"="yes"](area.sl);
  nwr["railway"~"^(station|halt)$"]["subway"!="yes"]["station"!="subway"](area.sl);
  node["railway"="tram_stop"](area.sl);
  nwr["amenity"="ferry_terminal"](area.sl);
  nwr["public_transport"="platform"]["ferry"="yes"](area.sl);
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
// SL's modes, as the stop icons show them: metro, train (pendeltåg, Roslagsbanan,
// Saltsjöbanan), tram (Tvärbanan, Lidingöbanan, Nockebybanan, Spårväg City), ferry, bus.
function typeOf(t) {
  if (isMetro(t)) return 'metro';
  if (t.railway === 'tram_stop' || t.station === 'light_rail' || t.light_rail === 'yes' || t.tram === 'yes') return 'tram';
  if (t.railway === 'station' || t.railway === 'halt') return 'train';
  if (t.amenity === 'ferry_terminal' || t.ferry === 'yes') return 'ferry';
  return 'bus';
}

// Rough metres between two lon/lat points (fine at this scale).
const dist = ([a, b], [c, d]) => {
  const k = Math.cos((b * Math.PI) / 180);
  return Math.hypot((a - c) * k, b - d) * 111320;
};

const features = [];
for (const el of elements) {
  const t = el.tags || {};
  if (!t.name) continue;
  const type = typeOf(t);
  // Skip entrances / non-bus platforms that slipped through, and disused / heritage stations.
  if (type === 'bus' && t.railway) continue;
  if (t.disused === 'yes' || t['disused:railway'] || t.usage === 'tourism' || t.historic) continue;
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
    properties: { name: t.name, type },
  });
}

// Rail stations: one point per station (OSM sometimes has node + area).
const seen = new Set();
const out = features.filter((f) => {
  if (!['metro', 'train'].includes(f.properties.type)) return true;
  const k = `${f.properties.type}|${f.properties.name}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

const fc = {
  type: 'FeatureCollection',
  metadata: {
    source: '© OpenStreetMap contributors (ODbL), via Overpass API',
    area: 'Stockholms län (SL)',
    generated: new Date().toISOString(),
  },
  features: out,
};
await writeFile(OUT, JSON.stringify(fc) + '\n');
const counts = out.reduce((m, f) => ((m[f.properties.type] = (m[f.properties.type] || 0) + 1), m), {});
console.log(`Wrote ${out.length} stops to ${OUT}`, counts);
