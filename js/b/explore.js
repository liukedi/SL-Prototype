// Version B (Tourist Mode on): the Map sheet gets two tabs under the search field.
//   - Explore (default): "The Art Metro" – the nearest special stations, sorted by distance
//     from the user ("See All" opens a full-screen list, closed with ×) – and "Curated
//     Routes", a row of cards (arrows / horizontal scroll); tapping a card or "View Route"
//     plans that trip in the Travel tab.
//   - The sheet's default position is higher while Tourist Mode is on (DEFAULT_TOP).
//   - Favorite: the original sheet content (favourites, Add favorite).
// Tourist Mode off: no tabs, the sheet is as in version A.
import { CONFIG } from '../config.js';
import { loadStopIndex, stopFromKey } from '../stop-index.js';
import { lineColor } from '../departures.js';
import { lineBadgeHtml, CHEVRON, esc } from '../departure-row.js';
import { touristMode } from './tourist-mode.js';

const SPECIAL_URL = './data/b/special-stations.json';
const ROUTES_URL = './data/b/curated-routes.json';
const GENERIC_ICON = 'special-generic.png';
const NEAREST = 3;
const DEFAULT_TOP = 430; // pt from the screen top, as in the design (version A: 479)
const CLOSE = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m3 3 14 14M17 3 3 17"/></svg>';
const ARROW_RIGHT = '<svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 7h17M12 1l6 6-6 6"/></svg>';
const ARROW_OUT = '<svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 9.5 9.5 2.5M4 2.5h5.5V8"/></svg>';
const chevron = (dir) => `<svg width="10" height="18" viewBox="0 0 10 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir === 'left' ? 'M8.5 1.5 1.5 9l7 7.5' : 'M1.5 1.5 8.5 9l-7 7.5'}"/></svg>`;

function km([lng1, lat1], [lng2, lat2]) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

export async function addExplore(app) {
  const [{ stations }, { routes }, { byKey }] = await Promise.all([
    fetch(SPECIAL_URL).then((r) => r.json()),
    fetch(ROUTES_URL).then((r) => r.json()),
    loadStopIndex(),
  ]);
  // Special stations, nearest first.
  const nearby = stations
    .map((s) => ({ ...s, stop: byKey.get(s.key) && stopFromKey(byKey, s.key) }))
    .filter((s) => s.stop?.lngLat)
    .map((s) => ({ ...s, km: km(CONFIG.userLocation, s.stop.lngLat) }))
    .sort((a, b) => a.km - b.km);

  const sheet = document.getElementById('sheet');
  const header = sheet.querySelector('.sheet__header');
  const tabs = document.createElement('div');
  tabs.className = 'b-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.innerHTML = `
    <button type="button" role="tab" data-btab="explore">Explore</button>
    <button type="button" role="tab" data-btab="favorite">Favorite</button>`;
  header.after(tabs);
  const panel = document.createElement('div');
  panel.className = 'sheet__body b-explore';
  document.getElementById('sheet-body').after(panel);

  const rowsHtml = (list) => list.map((s) => `
    <button type="button" class="b-artrow" data-key="${esc(s.key)}">
      <img src="icons/b/${esc(s.icon ?? GENERIC_ICON)}" alt="">
      <span>${esc(s.stop.name)}${CHEVRON}</span>
    </button>`).join('');
  const SUBTITLE = 'Explore Stockholm’s curated art metro stations, sorted by distance.';

  // ---- "See All": full-screen list (slides up like the search page, × closes it) ----
  const screen = document.getElementById('screen');
  const all = document.createElement('section');
  all.className = 'b-allart';
  all.setAttribute('aria-label', 'The Art Metro');
  all.innerHTML = `
    <div class="b-allart__head"><h2>The Art Metro</h2>
      <button type="button" class="sp-close" data-act="close-all" aria-label="Close">${CLOSE}</button></div>
    <div class="b-allart__body">
      <p class="b-sec__sub">${SUBTITLE}</p>
      <div class="b-artlist">${rowsHtml(nearby)}</div>
    </div>`;
  screen.appendChild(all);
  function openAll() {
    all.querySelector('.b-allart__body').scrollTop = 0;
    all.classList.remove('is-closing');
    all.classList.add('is-open');
  }
  function closeAll() {
    if (!all.classList.contains('is-open')) return;
    all.classList.add('is-closing');
    all.classList.remove('is-open');
    setTimeout(() => all.classList.remove('is-closing'), 280);
  }
  all.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="close-all"]')) return closeAll();
    const row = e.target.closest('.b-artrow');
    if (row) { closeAll(); app.openStop(stopFromKey(byKey, row.dataset.key)); }
  });
  document.querySelectorAll('.tabbar [data-tab]').forEach((t) => t.addEventListener('click', closeAll));
  const routeCard = (r) => {
    const stops = r.stops.map((k) => stopFromKey(byKey, k));
    const color = lineColor('metro', r.line);
    return `
      <article class="b-route" style="--line:${esc(color)}" data-route="${esc(r.stops[0])}>${esc(r.stops.at(-1))}">
        <div class="b-route__meta">${lineBadgeHtml({ mode: 'metro', line: r.line, color })}<span>${stops.length} stops, ${esc(r.duration)}</span></div>
        <h4>${esc(r.title)}</h4>
        <p>${esc(r.description)}</p>
        <div class="b-route__line" aria-hidden="true">${stops.map(() => '<i></i>').join('')}</div>
        <div class="b-route__ends"><span>${esc(stops[0].name)}</span><span>${esc(stops.at(-1).name)}</span></div>
        <button type="button" class="b-route__btn">View Route ${ARROW_OUT}</button>
      </article>`;
  };

  function render() {
    panel.innerHTML = `
      <div class="b-sec">
        <div class="b-sec__head"><h3>The Art Metro</h3>
          <button type="button" class="b-seeall" data-act="see-all">See All ${ARROW_RIGHT}</button></div>
        <p class="b-sec__sub">${SUBTITLE}</p>
      </div>
      <div class="b-artlist">${rowsHtml(nearby.slice(0, NEAREST))}</div>
      <div class="b-sec b-sec--routes">
        <div class="b-sec__head"><h3>Curated Routes</h3>
          <span class="b-arrows">
            <button type="button" class="b-arrow" data-scroll="-1" aria-label="Previous route">${chevron('left')}</button>
            <button type="button" class="b-arrow" data-scroll="1" aria-label="Next route">${chevron('right')}</button>
          </span></div>
        <p class="b-sec__sub">Short art trips by metro, ready to ride.</p>
      </div>
      <div class="b-routes">${routes.map(routeCard).join('')}</div>`;
    const track = panel.querySelector('.b-routes');
    track.addEventListener('scroll', updateArrows, { passive: true });
    updateArrows();
  }

  function updateArrows() {
    const track = panel.querySelector('.b-routes');
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth - 2;
    panel.querySelector('[data-scroll="-1"]').disabled = track.scrollLeft <= 2;
    panel.querySelector('[data-scroll="1"]').disabled = track.scrollLeft >= max;
  }

  function setTab(name) {
    sheet.dataset.btab = name;
    for (const b of tabs.querySelectorAll('[data-btab]')) {
      const on = b.dataset.btab === name;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    }
  }

  tabs.addEventListener('click', (e) => {
    const t = e.target.closest('[data-btab]');
    if (t) setTab(t.dataset.btab);
  });

  panel.addEventListener('click', (e) => {
    const row = e.target.closest('.b-artrow');
    if (row) return app.openStop(stopFromKey(byKey, row.dataset.key));
    if (e.target.closest('[data-act="see-all"]')) return openAll();
    const arrow = e.target.closest('[data-scroll]');
    if (arrow) {
      const track = panel.querySelector('.b-routes');
      const card = track.querySelector('.b-route');
      const step = card ? card.offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0) : track.clientWidth;
      return track.scrollBy({ left: step * Number(arrow.dataset.scroll), behavior: 'smooth' });
    }
    const route = e.target.closest('[data-route]');
    if (route) {
      const [from, to] = route.dataset.route.split('>').map((k) => stopFromKey(byKey, k));
      document.querySelector('.tabbar [data-tab="travel"]').click();
      app.travel.setEndpoint('from', from);
      app.travel.setEndpoint('to', to);
      document.querySelector('#page-travel [data-act="search"]')?.click();
    }
  });

  setTab('explore');
  render();
  const applyMode = (on) => {
    app.sheet.setDefaultTop(on ? DEFAULT_TOP : null);
    if (on) setTab('explore'); // back to Explore each time Tourist Mode is switched on
    else closeAll();
  };
  applyMode(touristMode.on);
  touristMode.subscribe(applyMode);
}
