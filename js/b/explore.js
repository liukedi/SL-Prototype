// Version B (Tourist Mode on): the Map sheet gets two tabs under the search field.
//   - Explore (default): "The Art Metro" – the nearest special stations, sorted by distance
//     from the user ("See All" opens a full-screen list, closed with ×) – and "Curated
//     Routes", a row of cards (arrows / horizontal scroll); a card opens a full-screen route
//     page (small route map, its stations, and a button that plans the way from the user's
//     location to the nearer end of the route – first or last station – in the Travel tab).
//   - A stop opened from See All or a route page returns there (same scroll) when closed.
//   - The sheet's default position is higher while Tourist Mode is on (DEFAULT_TOP).
//   - Favorite: the original sheet content (favourites, Add favorite).
// Tourist Mode off: no tabs, the sheet is as in version A.
import { CONFIG } from '../config.js';
import { loadStopIndex, stopFromKey, MY_LOCATION } from '../stop-index.js';
import { lineColor } from '../departures.js';
import { lineBadgeHtml, CHEVRON, esc } from '../departure-row.js';
import { createRouteMap } from '../map.js';
import { METRO_LINES } from '../routes.js';
import { touristMode } from './tourist-mode.js';
import { routeArtIcons } from './journey-art.js';

const SPECIAL_URL = './data/b/special-stations.json';
const ROUTES_URL = './data/b/curated-routes.json';
const GENERIC_ICON = 'special-generic.png';
const NEAREST = 3;
const DEFAULT_TOP = 350; // pt from the screen top (version A: 479)
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
  const [{ stations }, { routes }, { byKey, rows }] = await Promise.all([
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
  // See All filters (one at a time, like the stop page's mode chips; tap again for all).
  const CATEGORIES = [
    { id: 'art', label: 'Art Interior', icon: 'art-stadion.png' },
    { id: 'exhibition', label: 'Art Exhibits', icon: 'exhibition-hook.png' },
    { id: 'nature', label: 'Scenic View', icon: 'nature-gamla-stan.png' },
  ];
  let category = null;
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
      <div class="b-filters" role="group" aria-label="Filter by type">${CATEGORIES.map((c) => `
        <button type="button" class="chip b-filter" data-cat="${c.id}" aria-pressed="false"><img src="icons/b/${c.icon}" alt=""><span>${c.label}</span></button>`).join('')}
      </div>
      <div class="b-artlist"></div>
    </div>`;
  screen.appendChild(all);
  function renderAll() {
    for (const b of all.querySelectorAll('[data-cat]')) {
      const on = b.dataset.cat === category;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', String(on));
    }
    all.querySelector('.b-artlist').innerHTML = rowsHtml(category ? nearby.filter((s) => s.category === category) : nearby);
  }
  function openAll() {
    category = null;
    renderAll();
    all.querySelector('.b-allart__body').scrollTop = 0;
    all.classList.remove('is-closing');
    all.classList.add('is-open');
  }
  const closeAll = () => closePanel(all);
  all.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="close-all"]')) return closeAll();
    const chip = e.target.closest('[data-cat]');
    if (chip) {
      category = category === chip.dataset.cat ? null : chip.dataset.cat;
      return renderAll();
    }
    const row = e.target.closest('.b-artrow');
    if (row) openStopFrom(all, row.dataset.key);
  });

  // ---- Full-screen pages (See All, route page): open / close, and coming back from a stop ----
  function closePanel(el, after) {
    if (!el.classList.contains('is-open')) return;
    el.classList.add('is-closing');
    el.classList.remove('is-open');
    setTimeout(() => { el.classList.remove('is-closing'); after?.(); }, 280);
  }
  // A stop opened from a full-screen page: hide the page (kept as it is), and show it again,
  // scrolled where it was, when the stop page is closed.
  let returnTo = null;
  function openStopFrom(el, key) {
    returnTo = { el, scroll: el.querySelector('.b-allart__body').scrollTop };
    el.classList.remove('is-open');
    app.openStop(stopFromKey(byKey, key));
  }
  document.addEventListener('sl:close-stop', () => {
    if (!returnTo) return;
    const { el, scroll } = returnTo;
    returnTo = null;
    el.classList.add('is-open');
    el.querySelector('.b-allart__body').scrollTop = scroll;
    if (el === routePage) routeMap?.map.resize();
  });
  const leave = () => {
    returnTo = null;
    closeAll();
    closeRoute();
  };
  document.querySelectorAll('.tabbar [data-tab]').forEach((t) => t.addEventListener('click', leave));

  // ---- Route page: a curated route's map, stations and "Plan this trip" ----
  const iconOf = Object.fromEntries(stations.map((s) => [s.key, s.icon ?? GENERIC_ICON]));
  const metroStation = (name) => {
    let any = null;
    for (const [n, municipality, types, lng, lat] of rows) {
      if (n !== name || lng == null) continue;
      if (types.includes('m')) return { name, municipality, lngLat: [lng, lat] };
      any ??= { name, municipality, lngLat: [lng, lat] };
    }
    return any;
  };
  // The ride as a journey for createRouteMap: every station of the line between the ends.
  function routeJourney(r) {
    const ends = [r.stops[0], r.stops.at(-1)].map((k) => stopFromKey(byKey, k).name);
    const line = METRO_LINES[r.line] ?? [];
    const [a, b] = ends.map((n) => line.indexOf(n));
    const names = a < 0 || b < 0 ? r.stops.map((k) => stopFromKey(byKey, k).name)
      : a <= b ? line.slice(a, b + 1) : line.slice(b, a + 1).reverse();
    const stops = names.map(metroStation).filter((x) => x?.lngLat);
    return { legs: [{ mode: 'metro', line: r.line, color: lineColor('metro', r.line), stops }], startLngLat: null, endLngLat: null };
  }
  const routePage = document.createElement('section');
  routePage.className = 'b-allart b-routepage';
  screen.appendChild(routePage);
  let routeMap = null;
  let routeShown = null;
  function openRoute(i) {
    const r = routes[i];
    routeShown = r;
    const color = lineColor('metro', r.line);
    routePage.setAttribute('aria-label', r.title);
    routePage.innerHTML = `
      <div class="b-allart__head"><h2>${esc(r.title)}</h2>
        <button type="button" class="sp-close" data-act="close-route" aria-label="Close">${CLOSE}</button></div>
      <div class="b-allart__body">
        <div class="b-route__meta">${lineBadgeHtml({ mode: 'metro', line: r.line, color })}<span>${r.stops.length} stops, ${esc(r.duration)}</span></div>
        <p class="b-routepage__desc">${esc(r.description)}</p>
        <div class="b-routepage__map"></div>
        <h3 class="b-routepage__h">Stations</h3>
        <div class="b-artlist">${r.stops.map((k) => `
          <button type="button" class="b-artrow" data-key="${esc(k)}">
            <img src="icons/b/${esc(iconOf[k] ?? GENERIC_ICON)}" alt="">
            <span>${esc(stopFromKey(byKey, k).name)}${CHEVRON}</span>
          </button>`).join('')}
        </div>
        <button type="button" class="b-routepage__plan" data-act="plan">Go to ${esc(nearestStop(r).name)} ${ARROW_OUT}</button>
        <p class="b-routepage__note">Start from the end of this route nearest to you</p>
      </div>`;
    routePage.classList.remove('is-closing');
    routePage.classList.add('is-open');
    routeMap?.remove();
    routeMap = null;
    const journey = routeJourney(r);
    createRouteMap(routePage.querySelector('.b-routepage__map'), journey).then((m) => {
      if (routeShown !== r) return m.remove(); // closed or another route opened meanwhile
      routeMap = m;
      routeArtIcons(m, journey)?.setFullscreen(true);
    });
  }
  function closeRoute() {
    routeShown = null;
    closePanel(routePage, () => { routeMap?.remove(); routeMap = null; });
  }
  // Where the user joins the route: whichever end (first or last station) is nearer to them.
  function nearestStop(r) {
    return [r.stops[0], r.stops.at(-1)].map((k) => stopFromKey(byKey, k)).filter((x) => x.lngLat)
      .reduce((best, x) => (km(CONFIG.userLocation, x.lngLat) < km(CONFIG.userLocation, best.lngLat) ? x : best));
  }
  function planTrip(r) {
    const [from, to] = [MY_LOCATION, nearestStop(r)];
    document.querySelector('.tabbar [data-tab="travel"]').click();
    app.travel.setEndpoint('from', from);
    app.travel.setEndpoint('to', to);
    document.querySelector('#page-travel [data-act="search"]')?.click();
  }
  routePage.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close-route') return closeRoute();
    if (act === 'plan') return planTrip(routeShown);
    const row = e.target.closest('.b-artrow');
    if (row) openStopFrom(routePage, row.dataset.key);
  });
  const routeCard = (r, i) => {
    const stops = r.stops.map((k) => stopFromKey(byKey, k));
    const color = lineColor('metro', r.line);
    return `
      <article class="b-route" style="--line:${esc(color)}" data-route="${i}">
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
    // After a manual scroll (trackpad), continue from the card now in view.
    // (Not right after an arrow press: quick presses must not be undone by the animation ending.)
    track.addEventListener('scrollend', () => { if (performance.now() - lastStep > 700) routeIndex = currentRoute(track); });
    routeIndex = 0;
    updateArrows();
  }

  // Curated Routes arrows: one card per press. Positions come from the cards themselves,
  // so "previous" from the end lands on the card before, not wherever snapping pulls it.
  let routeIndex = 0;
  let lastStep = 0;
  const cardStart = (track, card) => card.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft);
  const maxScroll = (track) => track.scrollWidth - track.clientWidth;
  function currentRoute(track) {
    const cards = [...track.querySelectorAll('.b-route')];
    if (track.scrollLeft >= maxScroll(track) - 2) return cards.length - 1;
    let best = 0;
    cards.forEach((c, i) => {
      if (Math.abs(cardStart(track, c) - track.scrollLeft) < Math.abs(cardStart(track, cards[best]) - track.scrollLeft)) best = i;
    });
    return best;
  }
  function stepRoutes(dir) {
    const track = panel.querySelector('.b-routes');
    const cards = [...track.querySelectorAll('.b-route')];
    lastStep = performance.now();
    routeIndex = Math.max(0, Math.min(cards.length - 1, routeIndex + dir));
    // Scrolled to the end, the last cards are all in view: going back starts from there.
    if (dir < 0) while (routeIndex > 0 && cardStart(track, cards[routeIndex]) >= track.scrollLeft - 2) routeIndex -= 1;
    track.scrollTo({ left: Math.min(cardStart(track, cards[routeIndex]), maxScroll(track)), behavior: 'smooth' });
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
      return stepRoutes(Number(arrow.dataset.scroll));
    }
    const route = e.target.closest('[data-route]');
    if (route) openRoute(Number(route.dataset.route));
  });

  setTab('explore');
  render();
  const applyMode = (on) => {
    app.sheet.setDefaultTop(on ? DEFAULT_TOP : null);
    if (on) setTab('explore'); // back to Explore each time Tourist Mode is switched on
    else leave();
  };
  applyMode(touristMode.on);
  touristMode.subscribe(applyMode);
}
