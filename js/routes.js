// Stops along a ride, for journey details (intermediate stops + route line on the map).
// - Metro: real station sequences of the SL lines.
// - Anything else (or a metro station not on that line): real stops of the same mode
//   found in a corridor between the two ends, in order.
import { MODES } from './departures.js';

const RED_SOUTH = ['T-Centralen', 'Gamla stan', 'Slussen', 'Mariatorget', 'Zinkensdamm', 'Hornstull', 'Liljeholmen'];
const GREEN_WEST = ['Hässelby strand', 'Hässelby gård', 'Johannelund', 'Vällingby', 'Råcksta', 'Blackeberg', 'Islandstorget', 'Ängbyplan', 'Åkeshov', 'Brommaplan', 'Abrahamsberg', 'Stora mossen', 'Alvik', 'Kristineberg', 'Thorildsplan', 'Fridhemsplan', 'S:t Eriksplan', 'Odenplan', 'Rådmansgatan', 'Hötorget', 'T-Centralen', 'Gamla stan', 'Slussen', 'Medborgarplatsen', 'Skanstull', 'Gullmarsplan'];
const BLUE_CORE = ['Kungsträdgården', 'T-Centralen', 'Rådhuset', 'Fridhemsplan', 'Stadshagen', 'Västra skogen'];

export const METRO_LINES = {
  13: ['Ropsten', 'Gärdet', 'Karlaplan', 'Östermalmstorg', ...RED_SOUTH, 'Aspudden', 'Örnsberg', 'Axelsberg', 'Mälarhöjden', 'Bredäng', 'Sätra', 'Skärholmen', 'Vårberg', 'Vårby gård', 'Masmo', 'Fittja', 'Alby', 'Hallunda', 'Norsborg'],
  14: ['Mörby centrum', 'Danderyds sjukhus', 'Bergshamra', 'Universitetet', 'Tekniska högskolan', 'Stadion', 'Östermalmstorg', ...RED_SOUTH, 'Midsommarkransen', 'Telefonplan', 'Hägerstensåsen', 'Västertorp', 'Fruängen'],
  17: [...GREEN_WEST.slice(GREEN_WEST.indexOf('Åkeshov')), 'Skärmarbrink', 'Hammarbyhöjden', 'Björkhagen', 'Kärrtorp', 'Bagarmossen', 'Skarpnäck'],
  18: [...GREEN_WEST.slice(GREEN_WEST.indexOf('Alvik')), 'Skärmarbrink', 'Blåsut', 'Sandsborg', 'Skogskyrkogården', 'Tallkrogen', 'Gubbängen', 'Hökarängen', 'Farsta', 'Farsta strand'],
  19: [...GREEN_WEST, 'Globen', 'Enskede gård', 'Sockenplan', 'Svedmyra', 'Stureby', 'Bandhagen', 'Högdalen', 'Rågsved', 'Hagsätra'],
  10: [...BLUE_CORE, 'Huvudsta', 'Solna strand', 'Sundbybergs centrum', 'Duvbo', 'Rissne', 'Rinkeby', 'Tensta', 'Hjulsta'],
  11: [...BLUE_CORE, 'Solna centrum', 'Näckrosen', 'Hallonbergen', 'Kista', 'Husby', 'Akalla'],
};

function km([lng1, lat1], [lng2, lat2]) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

export function pathKm(path) {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += km(path[i - 1].lngLat, path[i].lngLat);
  return d;
}

// Metro station by name (prefers the metro entry in the index).
function station(rows, name) {
  let any = null;
  for (const [n, municipality, types, lng, lat] of rows) {
    if (n !== name || lng == null) continue;
    const s = { name: n, municipality, types, lngLat: [lng, lat] };
    if (types.includes('m')) return s;
    any ??= s;
  }
  return any;
}

// Real stops of the mode in a corridor between a and b, ordered, spaced out.
function corridor(rows, a, b, mode) {
  const letter = MODES[mode]?.letter ?? 'b';
  const total = km(a.lngLat, b.lngLat);
  const width = Math.max(0.35, Math.min(1.5, total * 0.08)); // km either side of the line
  const minGap = mode === 'bus' ? 0.35 : 0.8;
  const max = Math.min(14, Math.floor(total / minGap));
  const [ax, ay] = a.lngLat;
  const kx = Math.cos((ay * Math.PI) / 180);
  const dx = (b.lngLat[0] - ax) * kx;
  const dy = b.lngLat[1] - ay;
  const len2 = dx * dx + dy * dy || 1;
  const found = [];
  for (const [name, municipality, types, lng, lat] of rows) {
    if (!types.includes(letter) || lng == null || name === a.name || name === b.name) continue;
    const px = (lng - ax) * kx;
    const py = lat - ay;
    const t = (px * dx + py * dy) / len2;
    if (t <= 0.04 || t >= 0.96) continue;
    const off = Math.abs(px * dy - py * dx) / Math.sqrt(len2) * 111.32; // km from the line
    if (off <= width) found.push({ t, stop: { name, municipality, types, lngLat: [lng, lat] } });
  }
  found.sort((p, q) => p.t - q.t);
  const out = [];
  let lastT = 0;
  const gapT = minGap / (total || 1);
  for (const f of found) {
    if (f.t - lastT < gapT || out.some((s) => s.name === f.stop.name)) continue;
    out.push(f.stop);
    lastT = f.t;
  }
  // Keep at most `max`, evenly spread.
  if (out.length <= max) return out;
  const step = out.length / Math.max(1, max);
  return Array.from({ length: max }, (_, i) => out[Math.floor(i * step)]);
}

/**
 * Stops of one ride, from `a` to `b` inclusive: [{ name, lngLat, … }], plus the terminus
 * the vehicle is heading for (for "toward …") and, for metro, the previous station.
 */
export function legPath(rows, service, a, b) {
  const seq = service.mode === 'metro' ? METRO_LINES[service.line] : null;
  if (seq) {
    const i = seq.indexOf(a.name);
    const j = seq.indexOf(b.name);
    if (i >= 0 && j >= 0 && i !== j) {
      const names = i < j ? seq.slice(i, j + 1) : seq.slice(j, i + 1).reverse();
      const stops = names.map((n, k) => (k === 0 ? a : k === names.length - 1 ? b : station(rows, n))).filter((s) => s?.lngLat);
      // The station the vehicle comes from before reaching `a` (for its position on the map).
      const prevName = i < j ? seq[i - 1] : seq[i + 1];
      const prev = prevName ? station(rows, prevName) : null;
      return { stops, toward: i < j ? seq[seq.length - 1] : seq[0], prev };
    }
  }
  return { stops: [a, ...corridor(rows, a, b, service.mode), b], toward: service.directions?.[0] ?? b.name };
}
