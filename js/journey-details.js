// Journey details (Travel → Journey results → tap a journey): route map card (expandable to
// a full-screen "Map"), total time / transfers, one card per ride with its stops
// ("Show N stops"), transfer / walk rows between rides, and price information.
import { createRouteMap } from './map.js';
import { MODES } from './departures.js';
import { lineBadgeHtml, noticeHtml, esc } from './departure-row.js';
import { formatDuration, hhmm } from './journeys.js';

const I = {
  back: '<svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.5 2 2.5 11l9 9"/></svg>',
  locate: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M21 3 3.5 10.6l7.4 2.5 2.5 7.4z"/></svg>',
  expand: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2h6v6M18 2l-6.5 6.5M8 18H2v-6M2 18l6.5-6.5"/></svg>',
  clock: '<svg width="24" height="24" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="13" cy="13" r="11"/><path d="M13 7v6.5l4 2.5"/></svg>',
  transfer: '<svg width="24" height="18" viewBox="0 0 24 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h7l3 6h10M18 8l4 4-4 4"/></svg>',
  down: '<svg width="14" height="18" viewBox="0 0 14 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 2v14M2 11l5 5 5-5"/></svg>',
  chevron: '<svg width="18" height="12" viewBox="0 0 18 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 2 7 7 7-7"/></svg>',
  crowd: '<svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><g fill="currentColor"><circle cx="4" cy="3" r="2.2"/><rect x="1.8" y="6" width="4.4" height="9" rx="1.5"/></g><g fill="currentColor" opacity="0.4"><circle cx="11" cy="3" r="2.2"/><rect x="8.8" y="6" width="4.4" height="9" rx="1.5"/><circle cx="18" cy="3" r="2.2"/><rect x="15.8" y="6" width="4.4" height="9" rx="1.5"/></g></svg>',
  sl: '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="15" cy="15" r="13"/><path d="M5 11c4-3 16-3 20 0M5 19c4 3 16 3 20 0"/><text x="15" y="18.5" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor" stroke="none" font-family="sans-serif">SL</text></svg>',
};

const METRO_COLOUR = { 10: 'Blue', 11: 'Blue', 13: 'Red', 14: 'Red', 17: 'Green', 18: 'Green', 19: 'Green' };
function lineName(leg) {
  if (leg.mode === 'metro') return `Metro ${METRO_COLOUR[leg.line] ?? ''} line ${leg.line}`.replace('  ', ' ');
  if (leg.mode === 'train') return `Commuter rail line ${leg.line}`;
  if (leg.mode === 'tram') return `Light rail line ${leg.line}`;
  if (leg.mode === 'ferry') return `Boat ${leg.line}`;
  return `Bus ${leg.line}`;
}
const MODE_NOUN = { metro: 'metro', train: 'commuter rail', tram: 'light rail', bus: 'bus', ferry: 'boat' };
const minutesBetween = (a, b) => Math.max(0, Math.round((b - a) / 60000));
const walkMin = (m) => Math.max(1, Math.ceil(m / 75));

function legHtml(leg, i) {
  const between = leg.stops.slice(1, -1);
  const rail = leg.mode === 'metro' || leg.mode === 'train' || leg.mode === 'tram';
  const track = 1 + ((leg.toward.length + i) % 2); // stable sample "Track 1/2"
  return `
    <section class="jd-leg" style="--line:${esc(leg.color)}">
      <span class="jd-bar"></span>
      <div class="jd-row jd-row--end">
        <span class="jd-time"><b>${hhmm(leg.dep)}</b><span class="jd-dur">${formatDuration(leg.arr - leg.dep)}</span></span>
        <span class="jd-dot jd-dot--end"></span>
        <div class="jd-main">
          <div class="jd-stopline"><b>${esc(leg.from)}</b><span class="jd-badges"><img src="icons/${MODES[leg.mode].icon}.svg" alt="" width="28" height="28">${lineBadgeHtml(leg)}</span></div>
          <div class="jd-chips">${rail ? `<span>Track ${track}</span>` : ''}<span>${I.crowd}Typically quiet</span></div>
          <p class="jd-desc">${esc(lineName(leg))} toward ${esc(leg.toward)}</p>
          ${[...new Set(leg.notices ?? [])].map(noticeHtml).join('')}
          ${between.length ? `<button type="button" class="jd-toggle" data-n="${between.length}" aria-expanded="false"><span>Show ${between.length} stop${between.length > 1 ? 's' : ''}</span>${I.chevron}</button>` : ''}
        </div>
      </div>
      <div class="jd-stops" hidden>
        ${between.map((s) => `
          <div class="jd-row"><span class="jd-time">${hhmm(s.time)}</span><span class="jd-dot"></span><div class="jd-main">${esc(s.name)}</div></div>`).join('')}
      </div>
      <div class="jd-row jd-row--end">
        <span class="jd-time"><b>${hhmm(leg.arr)}</b></span>
        <span class="jd-dot jd-dot--end"></span>
        <div class="jd-main"><b>${esc(leg.to)}</b></div>
      </div>
    </section>`;
}

const stepHtml = (min, text) => `<div class="jd-step"><span>${min} min</span>${I.down}<span>${esc(text)}</span></div>`;

export function renderJourneyDetails(page, journey, { onBack }) {
  const j = journey;
  const parts = [];
  if (j.walkStartM) parts.push(stepHtml(walkMin(j.walkStartM), `Walk ${j.walkStartM} m to ${j.legs[0].from}`));
  j.legs.forEach((leg, i) => {
    if (i > 0) parts.push(stepHtml(minutesBetween(j.legs[i - 1].arr, leg.dep), `Transfer to ${MODE_NOUN[leg.mode]}`));
    parts.push(legHtml(leg, i));
  });
  if (j.walkEndM) parts.push(stepHtml(walkMin(j.walkEndM), `Walk ${j.walkEndM} m`));
  const waxholm = j.legs.some((l) => l.mode === 'ferry' && Number(l.line) >= 80 && Number(l.line) < 90);

  page.innerHTML = `
    <div class="details-head">
      <button type="button" class="round-btn results-back" data-act="back" aria-label="Back">${I.back}</button>
      <h2>Journey details</h2>
    </div>
    <div class="page__scroll page__scroll--details">
      <div class="jd-mapcard">
        <div class="jd-mapwrap">
          <div class="jd-map"></div>
          <div class="jd-fullhead">
            <button type="button" class="round-btn results-back" data-act="collapse" aria-label="Back">${I.back}</button>
            <h2>Map</h2>
          </div>
          <div class="jd-mapbtns">
            <button type="button" class="round-btn" data-act="locate" aria-label="Show my location">${I.locate}</button>
            <button type="button" class="round-btn jd-expand" data-act="expand" aria-label="Full-screen map">${I.expand}</button>
          </div>
        </div>
        <div class="jd-summary">
          <span>${I.clock}${formatDuration(j.arrive - j.depart)}</span>
          <span>${I.transfer}${j.transfers ? `${j.transfers} transfer${j.transfers > 1 ? 's' : ''}` : 'Direct'}</span>
        </div>
      </div>
      ${parts.join('')}
      <div class="sp-section sp-section--split jd-price-head"><h4>Price information</h4><span class="jd-adult">Adult</span></div>
      <div class="sp-card jd-price"><span class="jd-price__logo">${I.sl}</span><b>SL Single journey ticket</b><span>43 kr</span></div>
      ${waxholm ? '<div class="sp-card jd-note">You need a Waxholmsbolaget ticket for the boat.</div>' : ''}
      <p class="jd-price-text">The ticket price is calculated based on this specific journey.
        <button type="button" class="jd-link">Read more about how we calculate the price</button></p>
    </div>`;

  const wrap = page.querySelector('.jd-mapwrap');
  const card = page.querySelector('.jd-mapcard');
  let routeMap = null;
  let fullscreen = false;
  let disposed = false;
  createRouteMap(page.querySelector('.jd-map'), j).then((m) => {
    if (disposed) return m.remove(); // the page was left before the map finished loading
    routeMap = m;
    if (fullscreen) m.setFullscreen(true); // expand was pressed while loading
  });

  function setFullscreen(on) {
    fullscreen = on;
    // The full-screen map lives in the Travel page itself (so it never shows on other tabs).
    if (on) page.appendChild(wrap);
    else card.prepend(wrap);
    wrap.classList.toggle('is-fullscreen', on);
    routeMap?.setFullscreen(on);
  }

  page.onclick = (e) => {
    const toggle = e.target.closest('.jd-toggle');
    if (toggle) {
      const stops = toggle.closest('.jd-leg').querySelector('.jd-stops');
      const open = stops.hidden;
      stops.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      const n = Number(toggle.dataset.n);
      toggle.querySelector('span').textContent = `${open ? 'Hide' : 'Show'} ${n} stop${n > 1 ? 's' : ''}`;
      return;
    }
    switch (e.target.closest('[data-act]')?.dataset.act) {
      case 'back': return onBack();
      case 'expand': return setFullscreen(true);
      case 'collapse': return setFullscreen(false);
      case 'locate': return routeMap?.flyToUser();
      default:
    }
  };

  // Cleanup when leaving the page.
  return () => {
    disposed = true;
    page.onclick = null;
    routeMap?.remove();
  };
}
