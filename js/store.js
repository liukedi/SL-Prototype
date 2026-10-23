// Persistent user data (localStorage), shared by all pages:
//   favorites        – stops the user starred (newest first)
//   history          – stops picked from search results (newest first, max 10)
//   journeys         – From/To pairs searched in Travel (newest first, max 10)
//   favoriteJourneys – starred From/To pairs
// Stops are stored by key "Name|Municipality" (see js/stop-index.js); "My location" is "@me".
// A journey is stored as "fromKey>toKey".
// A first visit has neither. Add ?reset to the URL to wipe them, for both versions (e.g. between
// test sessions).

import { VARIANT } from './variant.js';

// Each test version keeps its own data, so testing A then B starts clean in both.
const STORAGE_KEY = `sl-proto-v1-${VARIANT}`;
const MAX_HISTORY = 10;

function load() {
  try {
    if (new URLSearchParams(location.search).has('reset')) {
      // ?reset wipes both versions (and the pre-A/B key from earlier test runs).
      for (const k of ['sl-proto-v1', 'sl-proto-v1-a', 'sl-proto-v1-b']) localStorage.removeItem(k);
    }
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (d && Array.isArray(d.favorites) && Array.isArray(d.history)) return { journeys: [], favoriteJourneys: [], ...d };
  } catch { /* storage blocked or corrupt: start empty */ }
  return { favorites: [], history: [], journeys: [], favoriteJourneys: [] };
}

const state = load();
const listeners = new Set();

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  for (const fn of listeners) fn();
}

const withFront = (list, key, max = Infinity) => [key, ...list.filter((k) => k !== key)].slice(0, max);

export const store = {
  favorites: () => [...state.favorites],
  history: () => [...state.history],
  isFavorite: (key) => state.favorites.includes(key),
  addFavorite(key) {
    if (state.favorites.includes(key)) return;
    state.favorites = [key, ...state.favorites];
    save();
  },
  removeFavorite(key) {
    state.favorites = state.favorites.filter((k) => k !== key);
    save();
  },
  toggleFavorite(key) {
    if (this.isFavorite(key)) this.removeFavorite(key);
    else this.addFavorite(key);
  },
  addHistory(key) {
    state.history = withFront(state.history, key, MAX_HISTORY);
    save();
  },
  clearHistory() {
    state.history = [];
    save();
  },
  journeys: () => [...state.journeys],
  addJourney(key) {
    state.journeys = withFront(state.journeys, key, MAX_HISTORY);
    save();
  },
  clearJourneys() {
    state.journeys = [];
    save();
  },
  isFavoriteJourney: (key) => state.favoriteJourneys.includes(key),
  toggleFavoriteJourney(key) {
    state.favoriteJourneys = state.favoriteJourneys.includes(key)
      ? state.favoriteJourneys.filter((k) => k !== key)
      : [key, ...state.favoriteJourneys];
    save();
  },
  // Called after every change; returns an unsubscribe function.
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
