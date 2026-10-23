// Travel tab: "Plan journey" (From / To, time, filters, Search, journey history) and
// "Journey results" (Faster journey / Fewer transfers, earlier / later journeys) and
// "Journey details" (js/journey-details.js) for a tapped journey.
// From / To are picked with the shared stop search page (modes 'from' / 'to').
import { store } from './store.js';
import { loadStopIndex, stopKey, stopFromKey } from './stop-index.js';
import { MODES } from './departures.js';
import { lineBadgeHtml, noticeMarkHtml, esc } from './departure-row.js';
import { planJourneys, formatDuration, hhmm } from './journeys.js';
import { initTimePicker, whenLabel, dayLabel } from './time-picker.js';
import { initFiltersSheet, DEFAULT_FILTERS, allowedModes } from './filters-sheet.js';
import { renderJourneyDetails } from './journey-details.js';
import { now as clockNow } from './clock.js';

const I = {
  swap: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 20V8M4.5 16.5 8 20l3.5-3.5M16 4v12M12.5 7.5 16 4l3.5 3.5"/></svg>',
  clock: '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="13" cy="13" r="11"/><path d="M13 7v6.5l4 2.5"/></svg>',
  filter: '<svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M2 2h18M5.5 8h11M9 14h4"/></svg>',
  back: '<svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.5 2 2.5 11l9 9"/></svg>',
  arrow: '<svg width="22" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 7h17M14 2l5 5-5 5"/></svg>',
  up: '<svg width="20" height="22" viewBox="0 0 20 22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 20V3M3 10l7-7 7 7"/></svg>',
  down: '<svg width="20" height="22" viewBox="0 0 20 22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2v17M3 12l7 7 7-7"/></svg>',
  starOn: '<svg width="26" height="25" viewBox="0 0 24 23" aria-hidden="true"><path d="m12 1.8 3.1 6.4 7 1-5.1 4.9 1.2 6.9L12 17.7 5.8 21l1.2-6.9-5.1-4.9 7-1z" fill="currentColor"/></svg>',
  starOff: '<svg width="26" height="25" viewBox="0 0 24 23" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="m12 1.8 3.1 6.4 7 1-5.1 4.9 1.2 6.9L12 17.7 5.8 21l1.2-6.9-5.1-4.9 7-1z"/></svg>',
  warn: '<svg width="24" height="22" viewBox="0 0 24 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.2 22.2 19.8H1.8z"/><path d="M12 8.6v5.2" stroke-linecap="round"/><circle cx="12" cy="16.9" r="0.4" fill="currentColor"/></svg>',
};
const SHOWN_AT_START = 5;

// "Stadion (Stockholm)", or "My location"
const placeLabel = (s) => (s ? (s.myLocation ? 'My location' : `${s.name} (${s.municipality})`) : '');

export function initTravel({ page, screen, searchPanel }) {
  const state = {
    from: null,
    to: null,
    when: { type: 'depart', date: null }, // date null = now
    filters: { ...DEFAULT_FILTERS },
    view: 'plan', // 'plan' | 'results' | 'details'
    detail: null, // the journey shown in 'details'
    sort: 'fast',
    all: [], // all generated journeys (chronological)
    start: 0,
    count: SHOWN_AT_START,
    loading: false,
  };
  let byKey = new Map();
  loadStopIndex().then((i) => { byKey = i.byKey; render(); });

  const timePicker = initTimePicker(screen, { onDone: (when) => { state.when = when; rerun(); } });
  const filtersSheet = initFiltersSheet(screen, { onDone: (f) => { state.filters = f; rerun(); } });

  // ---------- shared pieces ----------
  const odCard = () => `
    <div class="od-card">
      <button type="button" class="od-row" data-pick="from"><b>From</b><span>${esc(placeLabel(state.from))}</span></button>
      <button type="button" class="od-row" data-pick="to"><b>To</b><span>${esc(placeLabel(state.to))}</span></button>
      <button type="button" class="od-swap" data-act="swap" aria-label="Swap From and To">${I.swap}</button>
    </div>
    <div class="travel-opts">
      <button type="button" data-act="time">${I.clock}<span>${esc(whenLabel(state.when))}</span></button>
      <button type="button" data-act="filters"><span>Filters</span>${I.filter}</button>
    </div>`;

  function historyHtml() {
    const items = store.journeys();
    if (!items.length) return '';
    const half = (s) => (s.myLocation ? '<b>My location</b>' : `<b>${esc(s.name)}</b> ${esc(s.municipality)}`);
    return `
      <div class="sp-section sp-section--split travel-history-head"><h4>Search history</h4><button type="button" class="sp-clear-history" data-act="clear-journeys">Clear</button></div>
      <div class="sp-card">${items
        .map((key) => {
          const [f, t] = key.split('>').map((k) => stopFromKey(byKey, k));
          const fav = store.isFavoriteJourney(key);
          return `
          <div class="jh-row" data-journey="${esc(key)}" role="button" tabindex="-1">
            <span class="jh-route"><span class="jh-dot"></span><span class="jh-line"></span><span class="jh-dot"></span></span>
            <span class="jh-places"><span>${half(f)}</span><span>${half(t)}</span></span>
            <button type="button" class="sp-star" data-fav-journey="${esc(key)}" aria-label="${fav ? 'Remove from' : 'Add to'} favourites">${fav ? I.starOn : I.starOff}</button>
          </div>`;
        })
        .join('')}</div>`;
  }

  const legsHtml = (j) => {
    const parts = [];
    if (j.walkStartM) parts.push(`<span class="leg"><img src="icons/walk.svg" alt="Walk" width="24" height="24"><span class="leg__dist">${j.walkStartM} m</span></span>`);
    for (const l of j.legs) {
      parts.push(`<span class="leg"><img src="icons/${MODES[l.mode].icon}.svg" alt="${MODES[l.mode].label}" width="24" height="24">${lineBadgeHtml(l)}${l.notices?.length ? noticeMarkHtml : ''}</span>`);
    }
    if (j.walkEndM) parts.push(`<span class="leg"><img src="icons/walk.svg" alt="Walk" width="24" height="24"><span class="leg__dist">${j.walkEndM} m</span></span>`);
    return parts.join('<span class="leg-sep"></span>');
  };

  // ---------- results selection ----------
  // Faster: drop journeys that leave no later and arrive no earlier than another one.
  // Fewer transfers: keep only the journeys with the fewest transfers.
  function visibleList() {
    let list = state.all;
    if (state.sort === 'fewer') {
      const min = Math.min(...list.map((j) => j.transfers));
      list = list.filter((j) => j.transfers === min);
    } else {
      list = list.filter((j) => !list.some((k) => k !== j && k.depart >= j.depart && k.arrive <= j.arrive && (k.depart > j.depart || k.arrive < j.arrive)));
    }
    return list;
  }

  function resetWindow() {
    const list = visibleList();
    const ref = state.when.date ?? clockNow();
    if (state.when.type === 'arrive') {
      let last = -1;
      list.forEach((j, i) => { if (j.arrive <= ref) last = i; });
      state.start = Math.max(0, last + 1 - SHOWN_AT_START);
      state.count = Math.min(SHOWN_AT_START, last + 1 - state.start) || SHOWN_AT_START;
      return;
    } else {
      const firstOk = list.findIndex((j) => j.depart >= addMinutes(ref, -1));
      state.start = firstOk < 0 ? Math.max(0, list.length - SHOWN_AT_START) : firstOk;
    }
    state.count = SHOWN_AT_START;
  }
  const addMinutes = (d, m) => new Date(d.getTime() + m * 60000);

  function resultsHtml() {
    const list = visibleList();
    const shown = list.slice(state.start, state.start + state.count);
    const firstDay = shown[0] ? dayLabel(shown[0].depart) : 'Today';
    state.shown = shown;
    const rows = shown
      .map((j, i) => `
        <div class="journey" data-i="${i}" role="button" tabindex="-1">
          <div class="journey__top">
            <span class="journey__times">${hhmm(j.depart)}${I.arrow}${hhmm(j.arrive)}</span>
            <span class="journey__dur">${formatDuration(j.arrive - j.depart)}</span>
          </div>
          <div class="journey__from">${hhmm(j.boardAt)} from ${esc(j.boardName)}</div>
          <div class="journey__legs">${legsHtml(j)}</div>
        </div>`)
      .join('');
    const empty = state.loading ? '' : `<div class="journey-empty">${I.warn}<span>No journeys found. Try other stops, another time or fewer filters.</span></div>`;
    return `
      <div class="segmented results-sort">
        <button type="button" data-sort="fast" class="${state.sort === 'fast' ? 'is-selected' : ''}">Faster journey</button>
        <button type="button" data-sort="fewer" class="${state.sort === 'fewer' ? 'is-selected' : ''}">Fewer transfers</button>
      </div>
      ${shown.length && firstDay !== 'Today' ? `<div class="results-day">${firstDay}</div>` : ''}
      <div class="journey-card">
        ${shown.length && state.start > 0 ? `<button type="button" class="journey-more" data-act="earlier">${I.up}<span>Earlier journeys</span></button>` : ''}
        ${rows || empty}
        ${shown.length && state.start + state.count < list.length ? `<button type="button" class="journey-more journey-more--later" data-act="later">${I.down}<span>Later journeys</span></button>` : ''}
      </div>`;
  }

  // ---------- render ----------
  let leaveDetails = null;

  function render() {
    leaveDetails?.();
    leaveDetails = null;
    if (state.view === 'details') {
      leaveDetails = renderJourneyDetails(page, state.detail, {
        onBack: () => { state.view = 'results'; render(); },
      });
      return;
    }
    if (state.view === 'plan') {
      page.innerHTML = `
        <div class="page__scroll">
          <button class="service-pill glass" type="button"><span>Service status</span>${I.warn}</button>
          <h1 class="page-title travel-title">Plan journey</h1>
          ${odCard()}
          <button type="button" class="btn btn--blue btn--wide" data-act="search">Search</button>
          ${historyHtml()}
        </div>`;
    } else {
      const scrollTop = state.resultsScroll ?? page.querySelector('.page__scroll')?.scrollTop ?? 0;
      state.resultsScroll = null;
      page.innerHTML = `
        <div class="page__scroll page__scroll--results">
          <div class="results-head">
            <button type="button" class="round-btn results-back" data-act="back" aria-label="Back">${I.back}</button>
            <h2>Journey results</h2>
          </div>
          ${odCard()}
          ${resultsHtml()}
        </div>`;
      page.querySelector('.page__scroll').scrollTop = scrollTop;
    }
  }

  let searchId = 0;

  async function runSearch() {
    if (!state.from) return searchPanel.open('from');
    if (!state.to) return searchPanel.open('to');
    store.addJourney(`${stopKey(state.from)}>${stopKey(state.to)}`);
    state.view = 'results';
    state.loading = true;
    state.all = [];
    render();
    const id = ++searchId;
    const when = { type: state.when.type, date: state.when.date ?? clockNow() };
    const { journeys } = await planJourneys({ from: state.from, to: state.to, when, allowed: allowedModes(state.filters) });
    if (id !== searchId || state.view !== 'results') return; // a newer search started, or the user left
    state.all = journeys;
    state.loading = false;
    resetWindow();
    render();
  }
  const rerun = () => (state.view === 'results' ? runSearch() : render());

  page.addEventListener('click', (e) => {
    if (state.view === 'details') return; // handled by js/journey-details.js
    const t = e.target;
    const favJ = t.closest('[data-fav-journey]')?.dataset.favJourney;
    if (favJ) return store.toggleFavoriteJourney(favJ);
    const pick = t.closest('[data-pick]')?.dataset.pick;
    if (pick) return searchPanel.open(pick);
    const journey = t.closest('[data-journey]')?.dataset.journey;
    if (journey) {
      const [f, to] = journey.split('>').map((k) => stopFromKey(byKey, k));
      state.from = f;
      state.to = to;
      return runSearch();
    }
    const shownJourney = t.closest('.journey[data-i]');
    if (shownJourney) {
      state.detail = state.shown[Number(shownJourney.dataset.i)];
      state.resultsScroll = page.querySelector('.page__scroll')?.scrollTop ?? 0;
      state.view = 'details';
      return render();
    }
    const sort = t.closest('[data-sort]')?.dataset.sort;
    if (sort) { state.sort = sort; resetWindow(); return render(); }
    switch (t.closest('[data-act]')?.dataset.act) {
      case 'swap': [state.from, state.to] = [state.to, state.from]; return rerun();
      case 'time': return timePicker.open(state.when);
      case 'filters': return filtersSheet.open(state.filters);
      case 'search': return runSearch();
      case 'back': state.view = 'plan'; return render();
      case 'clear-journeys': return store.clearJourneys();
      case 'earlier': {
        const n = Math.min(3, state.start);
        state.start -= n;
        state.count += n;
        return render();
      }
      case 'later': state.count += 4; return render();
      default:
    }
  });
  store.subscribe(() => { if (state.view === 'plan') render(); });
  render();

  return {
    // Time picker / Filters live on the phone screen: close them when leaving the tab.
    closeOverlays() {
      timePicker.close();
      filtersSheet.close();
    },
    // Called by the search page in 'from' / 'to' mode.
    setEndpoint(which, stop) {
      state[which] = stop;
      if (state.view === 'results') runSearch();
      else render();
    },
  };
}
