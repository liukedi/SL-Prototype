// Stop page shown in the bottom sheet after picking a stop (search list, favourite card,
// or a stop on the map). Header: name, favourite star, close. Mode chips filter the
// departures (selecting a mode reveals its line chips); departures are grouped per mode.
import { store } from './store.js';
import { stopKey } from './stop-index.js';
import { MODES, MODE_ORDER, servicesOf, departuresFrom, listedNotices } from './departures.js';
import { departureRowHtml, lineBadgeHtml, noticeHtml, esc } from './departure-row.js';
import { now as clockNow } from './clock.js';

const MAX_PER_SECTION = 12;
const STAR_ON = '<svg width="26" height="25" viewBox="0 0 24 23" aria-hidden="true"><path d="m12 1.8 3.1 6.4 7 1-5.1 4.9 1.2 6.9L12 17.7 5.8 21l1.2-6.9-5.1-4.9 7-1z" fill="currentColor"/></svg>';
const STAR_OFF = '<svg width="26" height="25" viewBox="0 0 24 23" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="m12 1.8 3.1 6.4 7 1-5.1 4.9 1.2 6.9L12 17.7 5.8 21l1.2-6.9-5.1-4.9 7-1z"/></svg>';
const CLOSE = '<svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m3 3 14 14M17 3 3 17"/></svg>';
const FILTER = '<svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M2 2h18M5.5 8h11M9 14h4"/></svg>';

// Optional extra "Information" tab (used by version B for special stations; version A
// never sets a provider, so its stop page is unchanged). provider(stop) → { html } | null.
let infoProvider = null;
export function setStopInfoProvider(fn) { infoProvider = fn; }

const icon = (mode, size = 26) => `<img src="icons/${MODES[mode].icon}.svg" alt="" width="${size}" height="${size}">`;

export function initStopPage(container, { onClose }) {
  container.innerHTML = `
    <div class="stop-page__head">
      <h2 class="stop-page__title"></h2>
      <button type="button" class="round-btn stop-page__star"></button>
      <button type="button" class="round-btn stop-page__close" aria-label="Close">${CLOSE}</button>
    </div>
    <div class="stop-page__scroll"></div>`;
  const title = container.querySelector('.stop-page__title');
  const starBtn = container.querySelector('.stop-page__star');
  const scroll = container.querySelector('.stop-page__scroll');

  let stop = null;
  let services = [];
  let notices = [];
  let mode = null; // selected mode chip
  let line = null; // selected line chip
  let timer = null;
  let info = null; // { html } from the info provider, if this stop has an Information tab
  let tab = 'times'; // 'info' | 'times'

  function renderStar() {
    if (!stop) return;
    const fav = store.isFavorite(stopKey(stop));
    starBtn.innerHTML = fav ? STAR_ON : STAR_OFF;
    starBtn.setAttribute('aria-label', fav ? 'Remove from favourites' : 'Add to favourites');
  }

  function render() {
    if (!stop) return;
    const now = clockNow();
    const all = departuresFrom(stop, services, now);
    const modes = MODE_ORDER.filter((m) => all.some((d) => d.mode === m));
    const lines = mode ? [...new Map(all.filter((d) => d.mode === mode).map((d) => [d.line, d])).values()] : [];

    const chips = `
      <div class="stop-chips">
        <button type="button" class="chip chip--filter" aria-label="Filter">${FILTER}</button>
        ${modes.map((m) => `<button type="button" class="chip${m === mode ? ' is-selected' : ''}" data-mode="${m}">${icon(m)}<span>${MODES[m].label}</span></button>`).join('')}
      </div>
      ${lines.length ? `<div class="stop-chips stop-chips--lines">${lines
        .sort((a, b) => a.line.localeCompare(b.line, 'sv', { numeric: true }))
        .map((d) => `<button type="button" class="chip chip--line${d.line === line ? ' is-selected' : ''}" data-line="${esc(d.line)}">${lineBadgeHtml(d)}</button>`)
        .join('')}</div>` : ''}`;

    const sections = (mode ? [mode] : modes)
      .map((m, i) => {
        const deps = all.filter((d) => d.mode === m && (!line || m !== mode || d.line === line)).slice(0, MAX_PER_SECTION);
        return `
          <section class="stop-section">
            <h3 class="stop-section__title">${icon(m)}<span>${esc(stop.name)}</span></h3>
            ${i === 0 ? notices.map(noticeHtml).join('') : ''}
            <div class="stop-card stop-card--departures">${deps.map((d) => departureRowHtml(d, now)).join('')}</div>
          </section>`;
      })
      .join('');
    if (!info) { scroll.innerHTML = chips + sections; return; }
    const tabs = `
      <div class="stop-tabs" role="tablist">
        <button type="button" role="tab" data-stop-tab="info" class="${tab === 'info' ? 'is-selected' : ''}">Information</button>
        <button type="button" role="tab" data-stop-tab="times" class="${tab === 'times' ? 'is-selected' : ''}">Time Table</button>
      </div>`;
    scroll.innerHTML = tabs + (tab === 'info' ? info.html : chips + sections);
  }

  scroll.addEventListener('click', (e) => {
    const t = e.target.closest('[data-stop-tab]')?.dataset.stopTab;
    if (t) { tab = t; render(); return; }
    const m = e.target.closest('[data-mode]')?.dataset.mode;
    if (m) { mode = mode === m ? null : m; line = null; render(); return; }
    const l = e.target.closest('[data-line]')?.dataset.line;
    if (l) { line = line === l ? null : l; render(); }
  });
  starBtn.addEventListener('click', () => store.toggleFavorite(stopKey(stop)));
  container.querySelector('.stop-page__close').addEventListener('click', () => onClose?.());
  store.subscribe(renderStar);

  return {
    get stop() { return stop; },
    async open(s) {
      stop = s;
      mode = null;
      line = null;
      title.textContent = s.name;
      renderStar();
      scroll.innerHTML = '';
      scroll.scrollTop = 0;
      container.hidden = false;
      [services, notices, info] = await Promise.all([
        servicesOf(s),
        listedNotices().then((n) => n[stopKey(s)] ?? []),
        infoProvider ? infoProvider(s) : null,
      ]);
      tab = info ? 'info' : 'times';
      if (stop !== s) return; // another stop was opened meanwhile
      render();
      clearInterval(timer);
      timer = setInterval(render, 30000); // keep countdowns current
    },
    close() {
      clearInterval(timer);
      stop = null;
      container.hidden = true;
    },
  };
}
