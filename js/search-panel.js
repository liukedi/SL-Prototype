// Full-screen stop search that slides up when the sheet's search field is tapped.
// - Empty field: the user's Favourites and Search history (js/store.js). On a first
//   visit both are empty, so nothing is shown below the field.
// - Stars toggle favourites here; the sheet's favourite cards update at the same time.
// - Typing: the simulated iOS keyboard, or the computer keyboard (captured globally, so
//   no OS input method interferes). Tapping outside the keyboard hides it; tapping the
//   field or typing brings it back.
// - Results follow js/stop-search.js; Enter / the search key picks the first result.
// - Modes, same page: 'search' (sheet search field), 'favorite' ("Add favorite"),
//   'from' / 'to' (Travel; adds a "My location" card). onSelectStop(stop, mode) decides
//   what a pick does.
import { CONFIG } from './config.js';
import { createKeyboard } from './keyboard.js';
import { createStopSearch } from './stop-search.js';
import { loadStopIndex, stopKey, stopFromKey, MY_LOCATION } from './stop-index.js';
import { store } from './store.js';

const MAX_LEN = 40;
const TYPE_ICON = { m: 'metro', t: 'train', l: 'tram', f: 'ferry', b: 'bus' };

const STAR_ON = '<svg width="24" height="23" viewBox="0 0 24 23" aria-hidden="true"><path d="m12 1.8 3.1 6.4 7 1-5.1 4.9 1.2 6.9L12 17.7 5.8 21l1.2-6.9-5.1-4.9 7-1z" fill="currentColor"/></svg>';
const STAR_OFF = '<svg width="24" height="23" viewBox="0 0 24 23" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="m12 1.8 3.1 6.4 7 1-5.1 4.9 1.2 6.9L12 17.7 5.8 21l1.2-6.9-5.1-4.9 7-1z"/></svg>';

const NAV_ARROW = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M21 3 3.5 10.6l7.4 2.5 2.5 7.4z"/></svg>';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initSearchPanel({ screen, trigger, getSheetTop, onSelectStop }) {
  let search = () => ({ state: 'empty', results: [] });
  let byKey = new Map();
  const ready = loadStopIndex().then((index) => {
    byKey = index.byKey;
    search = createStopSearch(index.rows, { foldDiacritics: CONFIG.searchFoldDiacritics });
  });

  const panel = document.createElement('section');
  panel.className = 'search-panel';
  panel.setAttribute('aria-label', 'Search stop or station');
  panel.innerHTML = `
    <div class="search-panel__head">
      <div class="sp-field" role="searchbox" aria-label="Stop/station">
        <svg class="sp-field__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>
        <div class="sp-field__text"><span class="sp-field__value"></span><span class="sp-caret"></span><span class="sp-field__placeholder">Stop/station</span></div>
        <button type="button" class="sp-clear" aria-label="Clear text" hidden>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="currentColor"/><path d="m6.6 6.6 6.8 6.8M13.4 6.6l-6.8 6.8" stroke="#12151a" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <button type="button" class="sp-close" aria-label="Close search">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m3 3 14 14M17 3 3 17"/></svg>
      </button>
    </div>
    <div class="search-panel__body"></div>`;
  screen.appendChild(panel);

  const field = panel.querySelector('.sp-field');
  const valueEl = panel.querySelector('.sp-field__value');
  const clearBtn = panel.querySelector('.sp-clear');
  const body = panel.querySelector('.search-panel__body');

  let query = '';
  let results = [];
  let isOpen = false;
  let mode = 'search';

  const kb = createKeyboard({
    onInput: (ch) => setQuery(query + ch),
    onBackspace: () => setQuery(query.slice(0, -1)),
    onEnter: submit,
  });
  panel.appendChild(kb.el);
  body.style.setProperty('--kb-h', `${kb.height}px`);

  function showKeyboard() { kb.show(); panel.classList.add('is-focused'); }
  function hideKeyboard() { kb.hide(); panel.classList.remove('is-focused'); }

  function setQuery(q) {
    query = q.slice(0, MAX_LEN);
    render();
    body.scrollTop = 0;
  }

  // A favourites / history row: tap the row to pick the stop, tap the star to (un)favourite.
  const storeRow = (key, source) => {
    const stop = stopFromKey(byKey, key);
    const fav = store.isFavorite(key);
    return `
      <div class="sp-row" role="button" tabindex="-1" data-key="${esc(key)}" data-source="${source}">
        <span class="sp-row__text"><span class="sp-row__name">${esc(stop.name)}</span><span class="sp-row__mun">${esc(stop.municipality)}</span></span>
        <button type="button" class="sp-star" data-key="${esc(key)}" aria-label="${fav ? 'Remove from' : 'Add to'} favourites">${fav ? STAR_ON : STAR_OFF}</button>
      </div>`;
  };

  function favoritesAndHistoryHtml() {
    const favs = store.favorites();
    const hist = store.history();
    let html = '';
    if (mode === 'from' || mode === 'to') {
      html += `<button type="button" class="sp-card sp-myloc" data-myloc><span>My location</span>${NAV_ARROW}</button>`;
    }
    if (favs.length) {
      html += `<h4 class="sp-section">Favourites</h4><div class="sp-card">${favs.map((k) => storeRow(k, 'favorite')).join('')}</div>`;
    }
    if (hist.length) {
      html += `<div class="sp-section sp-section--split"><h4>Search history</h4><button type="button" class="sp-clear-history">Clear</button></div>
        <div class="sp-card">${hist.map((k) => storeRow(k, 'history')).join('')}</div>`;
    }
    return html;
  }

  function render() {
    valueEl.textContent = query;
    panel.classList.toggle('has-text', query.length > 0);
    clearBtn.hidden = query.length === 0;
    kb.setEnterEnabled(query.length > 0);

    const r = search(query);
    results = r.results;
    if (r.state === 'empty') body.innerHTML = favoritesAndHistoryHtml();
    else if (r.state === 'tooShort') body.innerHTML = '<div class="sp-card sp-hint">Enter at least two letters</div>';
    else if (r.state === 'none') {
      body.innerHTML = '<div class="sp-none"><h3>No search results</h3><p>Check the spelling or try a new search.</p></div>';
    } else {
      body.innerHTML = `<div class="sp-card">${results
        .map(
          (s, i) => `
          <button type="button" class="sp-row" data-i="${i}" data-source="result">
            <span class="sp-row__text"><span class="sp-row__name">${esc(s.name)}</span><span class="sp-row__mun">${esc(s.municipality)}</span></span>
            <img class="sp-row__icon" src="icons/${TYPE_ICON[s.types[0]] || 'bus'}.svg" alt="" width="30" height="30">
          </button>`
        )
        .join('')}</div>`;
    }
  }

  // Picking a stop. Stops picked from typed results go into the search history.
  function select(stop, source) {
    if (source === 'result') store.addHistory(stopKey(stop));
    onSelectStop?.(stop, mode);
  }

  // Enter / search key: pick the first result. No results: nothing.
  function submit() {
    if (results.length) select(results[0], 'result');
  }

  const placeholderEl = panel.querySelector('.sp-field__placeholder');
  const PLACEHOLDER = { from: 'From', to: 'To' };

  function open(openMode = 'search') {
    if (isOpen) return;
    isOpen = true;
    mode = openMode;
    placeholderEl.textContent = PLACEHOLDER[mode] ?? 'Stop/station';
    // Map: start where the sheet's top edge is. Travel: slide up from the bottom.
    const fromY = mode === 'from' || mode === 'to' ? null : getSheetTop();
    panel.style.setProperty('--from', fromY == null ? '100%' : `${Math.max(0, fromY - parseFloat(getComputedStyle(panel).top))}px`);
    panel.classList.remove('is-open', 'is-closing');
    void panel.offsetWidth; // restart the animation
    panel.classList.add('is-open');
    setQuery('');
    showKeyboard();
    ready.then(render);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    hideKeyboard();
    panel.classList.add('is-closing');
    panel.classList.remove('is-open');
    setTimeout(() => {
      if (isOpen) return; // reopened meanwhile: keep what is being typed
      panel.classList.remove('is-closing');
      setQuery('');
    }, 300);
  }

  store.subscribe(() => { if (isOpen && !query) render(); });
  trigger.addEventListener('click', () => open('search'));
  panel.querySelector('.sp-close').addEventListener('click', close);
  clearBtn.addEventListener('click', () => { setQuery(''); showKeyboard(); });
  field.addEventListener('click', showKeyboard);
  body.addEventListener('click', (e) => {
    const star = e.target.closest('.sp-star');
    if (star) { store.toggleFavorite(star.dataset.key); return; }
    if (e.target.closest('.sp-clear-history')) { store.clearHistory(); return; }
    if (e.target.closest('[data-myloc]')) { onSelectStop?.(MY_LOCATION, mode); return; }
    const row = e.target.closest('.sp-row');
    if (!row) return;
    if (row.dataset.source === 'result') select(results[Number(row.dataset.i)], 'result');
    else select(stopFromKey(byKey, row.dataset.key), row.dataset.source);
  });
  // Tapping anywhere outside the keyboard and the search field hides the keyboard.
  panel.addEventListener('pointerdown', (e) => {
    if (!kb.el.contains(e.target) && !field.contains(e.target) && !e.target.closest('.sp-close')) hideKeyboard();
  });

  // Computer keyboard. Captured on window so map shortcuts (+/-/arrows) don't fire meanwhile.
  window.addEventListener(
    'keydown',
    (e) => {
      if (!isOpen || e.metaKey || e.ctrlKey) return;
      let handled = true;
      if (e.key === 'Escape') { if (kb.visible) hideKeyboard(); else close(); }
      else if (e.key === 'Backspace') { showKeyboard(); setQuery(query.slice(0, -1)); }
      else if (e.key === 'Enter') { showKeyboard(); submit(); }
      else if (e.key.length === 1) { showKeyboard(); setQuery(query + e.key); }
      else handled = false;
      if (handled) {
        kb.flash(e.key);
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
  window.addEventListener('paste', (e) => {
    if (!isOpen) return;
    const text = e.clipboardData?.getData('text') || '';
    if (text) { showKeyboard(); setQuery(query + text.replace(/\s+/g, ' ')); e.preventDefault(); }
  });

  return { open, close, get isOpen() { return isOpen; } };
}
