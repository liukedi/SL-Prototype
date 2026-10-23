// Sample journey planner (no real routing in the prototype). Builds plausible journeys
// from the same sample services as the stop pages (js/departures.js):
//   - "My location" = a 130 m walk to Gärdet T (the fake user position).
//   - Direct ride when both ends share a line; otherwise one transfer: between two rail
//     lines at the listed stop serving both that is nearest the destination (e.g. 13 → 14
//     at Östermalmstorg), else T-Centralen; otherwise at the first line's stop nearest
//     the destination.
//   - Ride time from distance and mode speed; waits follow the lines' schedules.
//   - An extra slower direct bus gives "Fewer transfers" something to prefer.
// Respects the transport types switched off in Filters.
import { loadStopIndex, stopKey } from './stop-index.js';
import { servicesOf, departuresFrom, lineColor, listedServices, listedNotices, MODES } from './departures.js';
import { legPath, pathKm } from './routes.js';

const SPEED_KMH = { metro: 45, train: 60, tram: 28, bus: 20, ferry: 22 }; // average incl. stops
const PREFERENCE = ['metro', 'train', 'tram', 'bus', 'ferry'];
const RAIL = new Set(['metro', 'train', 'tram']);
const WALK_M_PER_MIN = 75;
const MY_LOCATION_STOP = 'Gärdet|Stockholm';
const MY_LOCATION_WALK_M = 130;
const TRANSFER_WALK_MIN = 3;

const addMin = (date, min) => new Date(date.getTime() + min * 60000);

function km([lng1, lat1], [lng2, lat2]) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}


function bestService(services, allowed) {
  for (const mode of PREFERENCE) {
    if (!allowed.has(mode)) continue;
    const s = services.find((x) => x.mode === mode);
    if (s) return s;
  }
  return null;
}

// Next departures of one line, one direction, from `stop` at/after `time` (minutes list).
function nextDepartures(stop, service, time, horizonMin) {
  const one = { ...service, directions: [service.directions[0]] };
  return departuresFrom(stop, [one], time, horizonMin);
}

function nearestWithMode(rows, target, letter, exceptKey) {
  let best = null;
  let bestD = Infinity;
  for (const [name, municipality, types, lng, lat] of rows) {
    if (!types.includes(letter) || lng == null || `${name}|${municipality}` === exceptKey) continue;
    const d = km([lng, lat], target.lngLat);
    if (d < bestD) { bestD = d; best = { name, municipality, types, lngLat: [lng, lat] }; }
  }
  return best;
}

// A listed stop served by both lines, nearest the destination.
function railHub(listed, byKey, first, last, dest, exclude) {
  let best = null;
  let bestD = Infinity;
  for (const [key, services] of Object.entries(listed)) {
    if (exclude.includes(key)) continue;
    const has = (s) => services.some((x) => x.mode === s.mode && x.line === s.line);
    const stop = byKey.get(key);
    if (!stop?.lngLat || !has(first) || !has(last)) continue;
    const d = km(stop.lngLat, dest.lngLat);
    if (d < bestD) { bestD = d; best = stop; }
  }
  return best;
}

// One ride: its stops (real metro sequences, else stops along the corridor), the
// terminus it heads for, and a time at every stop (by distance, ~20 s dwell per stop).
function rideLeg(rows, notices, service, from, to, dep, slow = 1) {
  const { stops, toward, prev } = legPath(rows, service, from, to);
  const speed = SPEED_KMH[service.mode] / slow;
  const extra = service.mode === 'bus' || service.mode === 'ferry' ? 1.15 : 1; // streets / fairways aren't straight
  let t = dep;
  const times = [dep];
  for (let i = 1; i < stops.length; i++) {
    const min = (pathKm([stops[i - 1], stops[i]]) * extra / speed) * 60 + 0.35;
    t = new Date(t.getTime() + min * 60000);
    times.push(t);
  }
  // Round to whole minutes, at least 2 min in total.
  const rounded = times.map((x, i) => (i === 0 ? dep : new Date(Math.round(x.getTime() / 60000) * 60000)));
  const arr = new Date(Math.max(rounded[rounded.length - 1].getTime(), dep.getTime() + 2 * 60000));
  rounded[rounded.length - 1] = arr;
  return {
    type: 'ride',
    mode: service.mode,
    line: service.line,
    color: lineColor(service.mode, service.line, service.color),
    from: from.name,
    to: to.name,
    toward,
    prev: prev?.lngLat ?? null,
    // Service notices for the stops where this ride starts or ends.
    notices: [...(notices[stopKey(from)] ?? []), ...(notices[stopKey(to)] ?? [])],
    stops: stops.map((s, i) => ({ name: s.name, lngLat: s.lngLat, time: rounded[i] })),
    dep,
    arr,
  };
}

/**
 * @param from, to   stops ({name, municipality, types, lngLat} or MY_LOCATION)
 * @param when       { type: 'depart' | 'arrive', date: Date }
 * @param allowed    Set of allowed modes (Filters)
 * @returns { journeys: [...], reason? }  journeys sorted by departure time
 */
export async function planJourneys({ from, to, when, allowed }) {
  const { rows, byKey } = await loadStopIndex();
  const end = (s) => (s.myLocation ? { stop: byKey.get(MY_LOCATION_STOP), walkM: MY_LOCATION_WALK_M } : { stop: s, walkM: 0 });
  const a = end(from);
  const b = end(to);
  if (!a.stop?.lngLat || !b.stop?.lngLat) return { journeys: [], reason: 'unknown' };
  if (stopKey(a.stop) === stopKey(b.stop)) return { journeys: [], reason: 'same' };

  const [svcA, svcB, listed, notices] = await Promise.all([servicesOf(a.stop), servicesOf(b.stop), listedServices(), listedNotices()]);
  const walkA = Math.ceil(a.walkM / WALK_M_PER_MIN);
  const walkB = Math.ceil(b.walkM / WALK_M_PER_MIN);

  // Window of departures to build journeys from.
  const start = when.type === 'arrive' ? addMin(when.date, -240) : addMin(when.date, -45);
  const horizonMin = when.type === 'arrive' ? 260 : 240;

  // Itinerary "shapes" (which lines, where to transfer); times are filled in per departure.
  const shapes = [];
  const shared = svcA.find((s) => allowed.has(s.mode) && svcB.some((t) => t.mode === s.mode && t.line === s.line));
  const first = bestService(svcA, allowed);
  const last = bestService(svcB, allowed);
  if (shared) shapes.push([{ service: shared, from: a.stop, to: b.stop }]);
  else if (first && last) {
    const hub = RAIL.has(first.mode) && RAIL.has(last.mode)
      ? railHub(listed, byKey, first, last, b.stop, [stopKey(a.stop), stopKey(b.stop)]) ?? byKey.get('T-Centralen|Stockholm')
      : nearestWithMode(rows, b.stop, MODES[first.mode].letter, stopKey(a.stop));
    if (hub && stopKey(hub) !== stopKey(b.stop) && stopKey(hub) !== stopKey(a.stop)) {
      shapes.push([{ service: first, from: a.stop, to: hub }, { service: last, from: hub, to: b.stop }]);
    } else shapes.push([{ service: last, from: a.stop, to: b.stop }]);
  }
  // Slower direct bus (fewer transfers), for trips within reach of a bus.
  const distance = km(a.stop.lngLat, b.stop.lngLat);
  if (allowed.has('bus') && distance < 30 && !(shapes[0]?.length === 1 && shapes[0][0].service.mode === 'bus')) {
    const seed = [...`${stopKey(a.stop)}>${stopKey(b.stop)}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const bus = { mode: 'bus', line: String(100 + (seed % 90)), directions: [b.stop.name], headway: 15 };
    shapes.push([{ service: bus, from: a.stop, to: b.stop, slow: 1.35 }]);
  }
  if (!shapes.length) return { journeys: [], reason: 'filters' };

  const journeys = [];
  for (const shape of shapes) {
    const deps = nextDepartures(shape[0].from, shape[0].service, addMin(start, walkA), horizonMin);
    for (const d of deps) {
      const legs = [];
      let t = addMin(addMin(start, walkA), d.minutes);
      shape.forEach((step, i) => {
        if (i > 0) {
          // Transfer: short walk, then the next departure of the connecting line.
          const ready = addMin(t, TRANSFER_WALK_MIN);
          const next = nextDepartures(step.from, step.service, ready)[0];
          t = addMin(ready, next ? next.minutes : 0);
        }
        const leg = rideLeg(rows, notices, step.service, step.from, step.to, t, step.slow);
        legs.push(leg);
        t = leg.arr;
      });
      const depart = addMin(legs[0].dep, -walkA);
      const arrive = addMin(t, walkB);
      journeys.push({
        from,
        to,
        startLngLat: from.myLocation ? from.lngLat : null,
        endLngLat: to.myLocation ? to.lngLat : null,
        depart,
        arrive,
        boardAt: legs[0].dep,
        boardName: a.stop.name,
        walkStartM: a.walkM,
        walkEndM: b.walkM,
        legs,
        transfers: legs.length - 1,
      });
    }
  }
  journeys.sort((x, y) => x.depart - y.depart || x.arrive - y.arrive);
  return { journeys };
}

export function formatDuration(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} hr${min % 60 ? ` ${min % 60} min` : ''}`;
}

export const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
