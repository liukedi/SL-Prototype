// Sample departures (there is no real-time data in the prototype).
// A stop's services come from data/departures.json when listed there; any other mode the
// stop has (from data/search-index.json) gets generated, deterministic sample services.
// Each service runs every `headway` minutes per direction, with times derived from the
// clock, so countdowns stay consistent between renders ("Nu", "2 min", … "07:10").
import { CONFIG } from './config.js';
import { loadStopIndex, stopKey } from './stop-index.js';
import { now as clockNow } from './clock.js';

export const MODES = {
  metro: { label: 'Metro', icon: 'metro', letter: 'm' },
  train: { label: 'Commuter rail', icon: 'train', letter: 't' },
  tram: { label: 'Tram/light rail', icon: 'tram', letter: 'l' },
  bus: { label: 'Bus', icon: 'bus', letter: 'b' },
  ferry: { label: 'Boat', icon: 'ferry', letter: 'f' },
};
export const MODE_ORDER = ['metro', 'train', 'tram', 'bus', 'ferry'];
const MODE_BY_LETTER = Object.fromEntries(Object.entries(MODES).map(([k, v]) => [v.letter, k]));

// SL line colours.
const RED = '#e3000f';
const GREEN = '#0e8a3f';
const BLUE = '#0b7fc4';
const METRO_COLOR = { 10: BLUE, 11: BLUE, 13: RED, 14: RED, 17: GREEN, 18: GREEN, 19: GREEN };
const TRAM_COLOR = { 7: '#878a83', 12: '#778da7', 21: '#b76934', 25: '#00a1b0', 26: '#00a1b0', 27: '#a3519a', 28: '#a3519a', 29: '#a3519a', 30: '#d77d00', 31: '#d77d00' };

export function lineColor(mode, line, override) {
  if (override) return override;
  const n = Number(line);
  if (mode === 'metro') return METRO_COLOR[n] ?? RED;
  if (mode === 'train') return '#ec619f';
  if (mode === 'tram') return TRAM_COLOR[n] ?? '#a3519a';
  if (mode === 'ferry') return '#00857a';
  return (n >= 1 && n <= 6) || (n >= 172 && n <= 179) ? '#0089ca' : RED; // blue trunk buses
}

// Real SL lines + end stations for generated metro / commuter rail services.
const METRO_LINES = [['13', 'Ropsten', 'Norsborg'], ['14', 'Mörby centrum', 'Fruängen'], ['17', 'Åkeshov', 'Skarpnäck'], ['18', 'Alvik', 'Farsta strand'], ['19', 'Hässelby strand', 'Hagsätra'], ['10', 'Kungsträdgården', 'Hjulsta'], ['11', 'Kungsträdgården', 'Akalla']];
const TRAIN_LINES = [['40', 'Uppsala C', 'Södertälje centrum'], ['41', 'Märsta', 'Södertälje centrum'], ['43', 'Bålsta', 'Nynäshamn']];

function seededRandom(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Modes a stop has, in display order. OSM sometimes tags metro stations as railway
// stations too, so 'train' is dropped when the stop is a metro station.
export function modesOf(stop) {
  const modes = new Set([...(stop.types || 'b')].map((l) => MODE_BY_LETTER[l]).filter(Boolean));
  if (modes.has('metro')) modes.delete('train');
  return MODE_ORDER.filter((m) => modes.has(m));
}

function generateServices(stop, mode, rows) {
  const rnd = seededRandom(`${stopKey(stop)}|${mode}`);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const others = (letter) => {
    const pool = rows.filter(([n, mun, t]) => mun === stop.municipality && t.includes(letter) && n !== stop.name);
    return () => (pool.length ? pick(pool)[0] : stop.municipality);
  };
  if (mode === 'metro') {
    const [line, a, b] = pick(METRO_LINES);
    return [{ mode, line, directions: [a, b], headway: 8 }];
  }
  if (mode === 'train') {
    const [line, a, b] = pick(TRAIN_LINES);
    return [{ mode, line, directions: [a, b], headway: 15 }];
  }
  if (mode === 'tram') {
    const dest = others('l');
    return [{ mode, line: pick(['7', '12', '21', '22', '25', '27', '30']), directions: [dest(), dest()], headway: 12 }];
  }
  if (mode === 'ferry') {
    const dest = others('f');
    return [{ mode, line: String(80 + Math.floor(rnd() * 10)), directions: [dest()], headway: 120 }];
  }
  const dest = others('b');
  return Array.from({ length: 2 + Math.floor(rnd() * 2) }, () => ({
    mode,
    line: String(1 + Math.floor(rnd() * 199)),
    directions: [dest(), dest()],
    headway: 10 + 5 * Math.floor(rnd() * 3),
  }));
}

let dataPromise = null;
function loadData() {
  dataPromise ??= Promise.all([fetch(CONFIG.departuresUrl).then((r) => r.json()), loadStopIndex()]);
  return dataPromise;
}

// Service notices: { 'Name|Municipality': [text, …] } from data/departures.json.
export async function listedNotices() {
  const [{ notices = {} }] = await loadData();
  return notices;
}

// Stops listed in data/departures.json with their services: { key: [service, …] }.
export async function listedServices() {
  const [{ services = {} }] = await loadData();
  return services;
}

// All services of a stop: listed ones first, then generated ones.
export async function servicesOf(stop) {
  const [{ services = {} }, { rows }] = await loadData();
  const listed = services[stopKey(stop)] ?? [];
  const covered = new Set(listed.map((s) => s.mode));
  // Rail lines can't be guessed reliably, so stops with listed services only get
  // generated bus / boat services on top.
  const canGenerate = (m) => !covered.has(m) && (!listed.length || m === 'bus' || m === 'ferry');
  const generated = modesOf(stop).filter(canGenerate).flatMap((m) => generateServices(stop, m, rows));
  return [...listed, ...generated];
}

// Upcoming departures within horizonMin minutes, soonest first:
// [{ mode, line, color, destination, minutes }].
export function departuresFrom(stop, services, now = clockNow(), horizonMin = 90) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const out = [];
  for (const s of services) {
    const h = s.headway || 10;
    const horizon = Math.max(horizonMin, 2 * h + 1);
    for (const destination of s.directions) {
      const offset = Math.floor(seededRandom(`${stopKey(stop)}|${s.line}|${destination}`)() * h);
      let m = (((offset - nowMin) % h) + h) % h;
      for (; m < horizon; m += h) {
        out.push({ mode: s.mode, line: s.line, color: lineColor(s.mode, s.line, s.color), destination, minutes: m });
      }
    }
  }
  return out.sort((a, b) => a.minutes - b.minutes || a.line.localeCompare(b.line, 'sv', { numeric: true }));
}

// "Nu", "7 min", or a clock time for later departures.
export function formatTime(minutes, now = clockNow()) {
  if (minutes === 0) return 'Nu';
  if (minutes < 30) return `${minutes} min`;
  const d = new Date(now.getTime() + minutes * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
