// Version B: Tourist Mode on/off (Map Setting sheet). Off = version B looks and behaves like
// version A; on = the tourist features (special stations, Information tab, …).
// Remembered per browser; ?reset clears it. Default from CONFIG.touristModeDefault.
import { CONFIG } from '../config.js';

const KEY = 'sl-proto-tourist-b';
const listeners = new Set();

function load() {
  try {
    if (new URLSearchParams(location.search).has('reset')) localStorage.removeItem(KEY);
    const v = localStorage.getItem(KEY);
    if (v === 'on' || v === 'off') return v === 'on';
  } catch { /* storage blocked */ }
  return CONFIG.touristModeDefault !== false;
}

let on = load();
document.documentElement.dataset.tourist = on ? 'on' : 'off';

export const touristMode = {
  get on() { return on; },
  set(value) {
    on = !!value;
    document.documentElement.dataset.tourist = on ? 'on' : 'off';
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
    for (const fn of listeners) fn(on);
  },
  // Called with the new state on every change.
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
