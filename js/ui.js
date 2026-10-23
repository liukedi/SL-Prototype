// UI overlay: entry point. Wires the sheet, favourites, stop search, stop page and buttons,
// and starts the map.
import { createMap } from './map.js';
import { initSheet } from './sheet.js';
import { fitDevice, getScale } from './device.js';
import { initSearchPanel } from './search-panel.js';
import { initFavorites } from './favorites.js';
import { store } from './store.js';
import { stopKey, loadStopIndex } from './stop-index.js';
import { initStopPage } from './stop-page.js';
import { MODES, modesOf } from './departures.js';
import { initTravel } from './travel.js';
import { initAmbience } from './ambience.js';
import { now as clockNow } from './clock.js';
import { isB } from './variant.js';

// The page itself must never zoom: only the map does.
// - Desktop: a trackpad pinch arrives as ctrl+wheel. MapLibre handles it on the map first;
//   this blocks the browser's page zoom everywhere.
// - iOS Safari ignores user-scalable=no, so block its gesture/double-tap zoom too.
function lockPageZoom() {
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 300 && !e.target.closest('#map')) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false }
  );
}

async function main() {
  lockPageZoom();
  // Status-bar clock follows the scenario clock (js/clock.js).
  const clockEl = document.querySelector('.status-bar__time');
  const tick = () => { const d = clockNow(); clockEl.textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  tick();
  setInterval(tick, 5000);

  // Hotel-room ambience for the test scenario (starts on the first click / key).
  initAmbience(document.getElementById('sound-toggle'));

  // Scale the phone mockup to the window; keep the map canvas sharp when scaled up.
  let map = null;
  const sharpen = (scale) => map?.map.setPixelRatio(window.devicePixelRatio * Math.max(1, scale));
  fitDevice(document.getElementById('device'), sharpen);

  const sheetEl = document.getElementById('sheet');
  const locateBtn = document.getElementById('locate');
  const sheet = initSheet(sheetEl, {
    tabbar: document.querySelector('.tabbar'),
    // Hide the locate button when the sheet is pulled up over most of the map.
    onChange: ({ top, height }) => locateBtn.classList.toggle('is-hidden', top < height * 0.35),
  });

  // ---- Stop page: opened from the search list, a favourite card or a stop on the map ----
  const stopPage = initStopPage(document.getElementById('stop-page'), { onClose: closeStop });

  function openStop(stop) {
    if (searchPanel.isOpen) searchPanel.close();
    sheetEl.classList.add('is-stop');
    stopPage.open(stop);
    sheet.refresh();
    sheet.snapTo('default');
    if (stop.lngLat) map?.focusStop(stop.lngLat, MODES[modesOf(stop)[0] ?? 'bus'].icon);
    document.dispatchEvent(new CustomEvent('sl:select-stop', { detail: stop }));
  }

  function closeStop() {
    stopPage.close();
    sheetEl.classList.remove('is-stop');
    sheet.refresh();
    sheet.snapTo('default');
    map?.clearStop();
  }

  // Tapping the search field opens the full-screen stop search: picking a stop opens its page.
  // "Add favorite" opens the same search page, and picking a stop there adds it as a
  // favourite (newest first, so the new card is visible right away in the default sheet).
  const searchPanel = initSearchPanel({
    screen: document.getElementById('screen'),
    trigger: sheetEl.querySelector('.search'),
    getSheetTop: () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-top')),
    onSelectStop: (stop, mode) => {
      if (mode === 'from' || mode === 'to') {
        travel.setEndpoint(mode, stop);
        searchPanel.close();
        return;
      }
      if (mode === 'favorite') {
        store.addFavorite(stopKey(stop));
        searchPanel.close();
        sheet.snapTo('default');
        return;
      }
      openStop(stop);
    },
  });
  // ---- Travel tab (journey planner) ----
  const travel = initTravel({
    page: document.getElementById('page-travel'),
    screen: document.getElementById('screen'),
    searchPanel,
  });

  // ---- Tab bar: Travel / Map / Tickets / More (Tickets and More are placeholders) ----
  const pages = { travel: 'page-travel', tickets: 'page-tickets', more: 'page-more' };
  document.querySelectorAll('.tabbar [data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (searchPanel.isOpen) searchPanel.close();
      travel.closeOverlays();
      document.querySelectorAll('.tabbar [data-tab]').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
        if (b === btn) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      for (const [name, id] of Object.entries(pages)) document.getElementById(id).hidden = name !== tab;
    });
  });

  initFavorites(document.getElementById('sheet-body'), {
    onAddFavorite: () => searchPanel.open('favorite'),
    onOpenStop: openStop,
  }).catch((err) => console.error('favourites', err));

  // A stop tapped on the map: match it to the search index by name + nearest position.
  async function openStopFromMap({ name, lngLat }) {
    const { rows } = await loadStopIndex();
    let best = null;
    let bestD = Infinity;
    for (const [n, municipality, types, lng, lat] of rows) {
      if (n !== name || lng == null) continue;
      const d = Math.hypot(lng - lngLat[0], lat - lngLat[1]);
      if (d < bestD) { bestD = d; best = { name: n, municipality, types, lngLat: [lng, lat] }; }
    }
    // Pin it where the user tapped (that platform), not at the stop's representative point.
    if (best) openStop({ ...best, lngLat });
  }

  map = await createMap('map', { onStopClick: openStopFromMap });
  sharpen(getScale());
  locateBtn.addEventListener('click', () => map.flyToUser());

  // Version B (redesign) adds its changes on top of the shared app.
  if (isB) {
    const { initVariantB } = await import('./b/index.js');
    initVariantB({ map, sheet, searchPanel, travel, openStop, closeStop });
  }
  // Service status and the non-Map tabs are intentionally inert in the baseline.
}

main().catch((err) => console.error(err));
