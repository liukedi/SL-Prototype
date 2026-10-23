// Version B: layers button (top-left of the map) → "Map Setting" sheet with the Tourist
// Mode switch. While the sheet is open, the normal bottom sheet and tab bar are hidden.
import { touristMode } from './tourist-mode.js';
import { showOnboarding, onboardingPending } from './onboarding.js';

const LAYERS = '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M13 3.5 23 9l-10 5.5L3 9z"/><path d="m3 13.2 10 5.5 10-5.5"/><path d="m3 17.4 10 5.5 10-5.5"/></svg>';
const CLOSE = '<svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m3 3 14 14M17 3 3 17"/></svg>';

export function addMapSettings() {
  const screen = document.getElementById('screen');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'layers-btn glass';
  button.setAttribute('aria-label', 'Map settings');
  button.innerHTML = LAYERS;
  screen.appendChild(button);

  const sheet = document.createElement('section');
  sheet.className = 'map-settings';
  sheet.setAttribute('aria-label', 'Map Setting');
  sheet.innerHTML = `
    <div class="sheet__handle" aria-hidden="true"></div>
    <div class="map-settings__head">
      <h2>Map Setting</h2>
      <button type="button" class="round-btn" data-act="close" aria-label="Close">${CLOSE}</button>
    </div>
    <p class="map-settings__section">EXPERIENCE IMPROVEMENTS</p>
    <p class="map-settings__hint">Enable visitor art metro recommendations.</p>
    <div class="map-settings__card">
      <span>Tourist Mode</span>
      <button type="button" class="switch switch--large" role="switch" data-act="tourist"><span></span></button>
    </div>`;
  screen.appendChild(sheet);
  const sw = sheet.querySelector('[data-act="tourist"]');

  function renderSwitch() {
    sw.classList.toggle('is-on', touristMode.on);
    sw.setAttribute('aria-checked', String(touristMode.on));
  }
  function open() {
    screen.classList.add('map-settings-open');
    sheet.classList.remove('is-closing');
    sheet.classList.add('is-open');
  }
  function close() {
    if (!sheet.classList.contains('is-open')) return;
    sheet.classList.add('is-closing');
    sheet.classList.remove('is-open');
    setTimeout(() => {
      sheet.classList.remove('is-closing');
      screen.classList.remove('map-settings-open');
    }, 260);
  }

  button.addEventListener('click', open);
  sheet.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') close();
    if (act === 'tourist') {
      touristMode.set(!touristMode.on);
      // First time on: close the sheet and show the intro cards.
      if (touristMode.on && onboardingPending()) setTimeout(() => { close(); setTimeout(showOnboarding, 280); }, 350);
    }
  });
  touristMode.subscribe(renderSwitch);
  renderSwitch();

  // Leaving the Map tab closes it.
  document.querySelectorAll('.tabbar [data-tab]').forEach((t) => t.addEventListener('click', close));
  return { open, close };
}
