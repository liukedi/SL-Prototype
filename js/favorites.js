// Favourite stops shown in the bottom sheet (the same favourites the search page lists).
// - No favourites: "You have no favorites added" card + "Add favorite" (first visit).
// - Each favourite: a card with its next 3 departures (js/departures.js); tapping the
//   card opens that stop's page.
// - Favourites live in js/store.js (localStorage) and survive reloads; the sheet
//   re-renders whenever they change anywhere, and every 30 s so countdowns stay current.
import { loadStopIndex, stopFromKey } from './stop-index.js';
import { servicesOf, departuresFrom } from './departures.js';
import { departureRowHtml, CHEVRON, esc } from './departure-row.js';
import { store } from './store.js';
import { now as clockNow } from './clock.js';

const STAR = '<svg width="36" height="34" viewBox="0 0 24 23" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="m12 1.8 3.1 6.4 7 1-5.1 4.9 1.2 6.9L12 17.7 5.8 21l1.2-6.9-5.1-4.9 7-1z"/></svg>';
const PLUS = '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="13" cy="13" r="11.5"/><path d="M13 7.5v11M7.5 13h11"/></svg>';

export async function initFavorites(container, { onAddFavorite, onOpenStop }) {
  const { byKey } = await loadStopIndex();
  let renderId = 0;

  async function render() {
    const id = ++renderId;
    const keys = store.favorites();
    const stops = keys.map((key) => stopFromKey(byKey, key));
    const services = await Promise.all(stops.map(servicesOf));
    if (id !== renderId) return; // a newer render started meanwhile
    const now = clockNow();
    const cards = stops
      .map((stop, i) => `
        <article class="stop-card" data-key="${esc(keys[i])}">
          <div class="stop-card__title"><span>${esc(stop.name)}</span>${CHEVRON}</div>
          ${departuresFrom(stop, services[i], now).slice(0, 3).map((d) => departureRowHtml(d, now)).join('')}
        </article>`)
      .join('');
    const empty = `<div class="fav-empty">${STAR}<p>You have no favorites added</p></div>`;
    container.innerHTML = `${keys.length ? cards : empty}
      <button type="button" class="fav-add">${PLUS}<span>Add favorite</span></button>`;
  }

  // One delegated listener: survives re-renders.
  container.addEventListener('click', (e) => {
    if (e.target.closest('.fav-add')) return onAddFavorite();
    const card = e.target.closest('.stop-card');
    if (card) onOpenStop?.(stopFromKey(byKey, card.dataset.key));
  });
  store.subscribe(render);
  setInterval(render, 30000);
  render();
}
