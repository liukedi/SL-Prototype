// Travel "Filters" sheet. The transport-type switches are used by the sample journey
// planner; "Include nearby stops", "Local transport", "Bike…" and "Exclude line" are visual
// only. Clear resets the switches; Done applies and closes; changes are dropped otherwise.
const ICON = { metro: 'metro', bus: 'bus', train: 'train', tram: 'tram', ferry: 'ferry', local: 'bus' };
const BIKE = '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><rect x="0.4" y="0.4" width="25.2" height="25.2" rx="4" fill="#90c8f4"/><g fill="none" stroke="#000" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="3.6"/><circle cx="18.5" cy="15.5" r="3.6"/><path d="m7.5 15.5 3.4-6h5.2l2.4 6M10.9 9.5l2.6 6h2.6M10.2 8h2.6"/></g></svg>';

export const DEFAULT_FILTERS = Object.freeze({
  nearby: false, metro: true, bus: true, train: true, tram: true, ferry: true, local: true, bike: false,
});

const ROWS = [
  ['metro', 'Metro'], ['bus', 'Bus'], ['train', 'Commuter rail'], ['tram', 'Tram/light rail'],
  ['ferry', 'Ferry'], ['local', 'Local transport'], ['bike', 'Bike at the start of the journey'],
];
const PLUS = '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="13" cy="13" r="11.5"/><path d="M13 7.5v11M7.5 13h11"/></svg>';

const toggle = (key, on) => `<button type="button" class="switch${on ? ' is-on' : ''}" role="switch" aria-checked="${on}" data-key="${key}"><span></span></button>`;

export function initFiltersSheet(screen, { onDone }) {
  const el = document.createElement('section');
  el.className = 'filters-sheet';
  el.setAttribute('aria-label', 'Filters');
  screen.appendChild(el);
  let draft = { ...DEFAULT_FILTERS };

  function render() {
    el.innerHTML = `
      <div class="filters-sheet__bar">
        <button type="button" class="pill-btn" data-act="clear">Clear</button>
        <button type="button" class="pill-btn" data-act="done">Done</button>
      </div>
      <div class="filters-sheet__scroll">
        <h2 class="page-title">Filters</h2>
        <div class="list-card"><div class="list-row"><span>Include nearby stops</span>${toggle('nearby', draft.nearby)}</div></div>
        <h4 class="list-heading">Transport types</h4>
        <div class="list-card">
          ${ROWS.map(([key, label]) => `
            <div class="list-row">
              ${key === 'bike' ? BIKE : `<img src="icons/${ICON[key]}.svg" alt="" width="26" height="26">`}
              <span>${label}</span>${toggle(key, draft[key])}
            </div>`).join('')}
        </div>
        <h4 class="list-heading">Exclude lines</h4>
        <div class="list-card"><button type="button" class="list-action">${PLUS}<span>Exclude line</span></button></div>
      </div>`;
  }

  el.addEventListener('click', (e) => {
    const sw = e.target.closest('.switch');
    if (sw) { draft[sw.dataset.key] = !draft[sw.dataset.key]; render(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'clear') { draft = { ...DEFAULT_FILTERS }; render(); }
    if (act === 'done') { onDone({ ...draft }); close(); }
  });

  function open(current) {
    draft = { ...current };
    render();
    el.classList.remove('is-closing');
    el.classList.add('is-open');
  }
  function close() {
    if (!el.classList.contains('is-open')) return;
    el.classList.add('is-closing');
    el.classList.remove('is-open');
    setTimeout(() => el.classList.remove('is-closing'), 280);
  }
  return { open, close };
}

// Modes allowed by the filters, for the journey planner.
export const allowedModes = (f) => new Set(['metro', 'bus', 'train', 'tram', 'ferry'].filter((m) => f[m]));
