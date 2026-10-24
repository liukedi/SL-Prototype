// Sunset time for a place and day (NOAA solar position approximation, good to a minute or
// two), formatted as Stockholm wall-clock time – the time the scenario clock shows.
const rad = Math.PI / 180;

// Sunset as a JS Date (UTC instant) for the calendar day of `date`, or null (polar day/night).
export function sunset([lng, lat], date) {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const n = Math.ceil(day / 864e5 + 2440587.5 - 2451545 + 0.0008); // days since J2000.0
  const jStar = n - lng / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const dec = Math.asin(Math.sin(L * rad) * Math.sin(23.44 * rad));
  const cosH = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec));
  if (cosH < -1 || cosH > 1) return null;
  const jSet = jTransit + Math.acos(cosH) / rad / 360;
  return new Date((jSet - 2440587.5) * 864e5);
}

// "17:05" in Stockholm time.
export const stockholmHHMM = (d) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' }).format(d);

// Minutes after midnight of an "HH:MM" string.
export const minutesOf = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
