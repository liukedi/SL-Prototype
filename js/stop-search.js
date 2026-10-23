// Stop search logic (no DOM). Mirrors the SL app's search behaviour:
//   - empty query            → state 'empty'     (nothing shown)
//   - 1 letter               → state 'tooShort'  ("Enter at least two letters")
//   - ≥2 letters, no stop whose name (or a word in it) starts with the first two letters
//                            → state 'none'      ("No search results")
//   - otherwise              → state 'results', ranked by similarity to the whole query.
//     Stops stay listed as long as the first two letters match, even if letter 3+ doesn't.

const MAX_RESULTS = 30;
const STATION_TYPES = /[mtlf]/; // metro, train, tram, ferry rank above bus-only stops on ties

// Lowercase, keep letters/digits only. With foldDiacritics, å/ä→a, ö→o, é→e …
export function normalize(s, foldDiacritics = true) {
  let t = s.toLowerCase();
  if (foldDiacritics) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return t.replace(/[^\p{L}\p{N}]+/gu, '');
}

// Optimal-string-alignment distance (Levenshtein + adjacent transpositions).
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

function commonPrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// rows: [[name, municipality, types], …] from data/search-index.json
export function createStopSearch(rows, { foldDiacritics = true } = {}) {
  const entries = rows.map(([name, municipality, types, lng, lat]) => {
    // Searchable targets: the whole name, plus the name from each later word onwards
    // ("T-Centralen" → "tcentralen", "centralen").
    const targets = [];
    const parts = name.split(/[\s\-/().,]+/).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      targets.push({ key: normalize(parts.slice(i).join(' '), foldDiacritics), wordStart: i > 0 });
    }
    return { name, municipality, types, lngLat: lng != null ? [lng, lat] : null, targets };
  });

  return function search(query) {
    const q = normalize(query, foldDiacritics);
    if (q.length === 0) return { state: 'empty', results: [] };
    if (q.length < 2) return { state: 'tooShort', results: [] };
    const head = q.slice(0, 2);

    const scored = [];
    for (const e of entries) {
      let best = null;
      for (const t of e.targets) {
        if (!t.key.startsWith(head)) continue;
        const s = {
          lcp: commonPrefix(q, t.key),
          dist: editDistance(q, t.key.slice(0, q.length)),
          wordStart: t.wordStart ? 1 : 0,
        };
        if (!best || s.lcp > best.lcp || (s.lcp === best.lcp && (s.dist < best.dist || (s.dist === best.dist && s.wordStart < best.wordStart)))) best = s;
      }
      if (best) scored.push({ entry: e, ...best, station: STATION_TYPES.test(e.types) ? 0 : 1 });
    }
    if (!scored.length) return { state: 'none', results: [] };

    scored.sort(
      (a, b) =>
        b.lcp - a.lcp ||
        a.dist - b.dist ||
        a.wordStart - b.wordStart ||
        a.station - b.station ||
        a.entry.name.length - b.entry.name.length ||
        a.entry.name.localeCompare(b.entry.name, 'sv') ||
        a.entry.municipality.localeCompare(b.entry.municipality, 'sv')
    );
    return {
      state: 'results',
      results: scored.slice(0, MAX_RESULTS).map(({ entry: { name, municipality, types, lngLat } }) => ({ name, municipality, types, lngLat })),
    };
  };
}
