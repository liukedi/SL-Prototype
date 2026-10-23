// "When do you want to travel?" bottom sheet: Departure / Arrival time and wheel columns
// for day, hour and minute (24-hour clock). Columns scroll with the mouse wheel / trackpad
// and snap to rows; clicking a value selects it. "Leave Now" resets to departing now.
import { now as clockNow } from './clock.js';
const ROW = 40; // px per wheel row
const DAYS_BACK = 3;
const DAYS_AHEAD = 13;

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

export const dayLabel = (d, today = clockNow()) => {
  const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `${WD[d.getDay()]} ${MO[d.getMonth()]} ${d.getDate()}`;
};

export function initTimePicker(screen, { onDone }) {
  const el = document.createElement('div');
  el.className = 'tp-backdrop';
  el.hidden = true;
  el.innerHTML = `
    <section class="tp-sheet" role="dialog" aria-label="When do you want to travel?">
      <div class="tp-handle"></div>
      <h3 class="tp-title">When do you want to travel?</h3>
      <div class="segmented tp-type">
        <button type="button" data-type="depart">Departure time</button>
        <button type="button" data-type="arrive">Arrival time</button>
      </div>
      <div class="tp-wheels">
        <div class="tp-band"></div>
        <div class="tp-col tp-col--day"></div>
        <div class="tp-col tp-col--hour"></div>
        <div class="tp-col tp-col--min"></div>
      </div>
      <div class="tp-actions">
        <button type="button" class="btn btn--grey" data-act="now">Leave Now</button>
        <button type="button" class="btn btn--blue" data-act="done">Done</button>
      </div>
    </section>`;
  screen.appendChild(el);

  const cols = {
    day: el.querySelector('.tp-col--day'),
    hour: el.querySelector('.tp-col--hour'),
    min: el.querySelector('.tp-col--min'),
  };
  let type = 'depart';
  let days = [];

  function fill(col, labels) {
    col.innerHTML = `<div class="tp-pad"></div>${labels.map((l, i) => `<div class="tp-item" data-i="${i}">${l}</div>`).join('')}<div class="tp-pad"></div>`;
  }
  const index = (col) => Math.round(col.scrollTop / ROW);
  const scrollToIndex = (col, i, smooth) => col.scrollTo({ top: i * ROW, behavior: smooth ? 'smooth' : 'auto' });

  // Highlight the row in the band, fade the others (like the iOS picker).
  function paint(col) {
    const sel = index(col);
    col.querySelectorAll('.tp-item').forEach((it) => {
      const dist = Math.abs(Number(it.dataset.i) - sel);
      it.classList.toggle('is-selected', dist === 0);
      it.style.opacity = String(Math.max(0.25, 1 - dist * 0.25));
    });
  }
  for (const col of Object.values(cols)) {
    col.addEventListener('scroll', () => paint(col), { passive: true });
    col.addEventListener('click', (e) => {
      const it = e.target.closest('.tp-item');
      if (it) scrollToIndex(col, Number(it.dataset.i), true);
    });
  }

  function setType(t) {
    type = t;
    el.querySelectorAll('[data-type]').forEach((b) => b.classList.toggle('is-selected', b.dataset.type === t));
  }

  function selectedDate() {
    const d = new Date(days[index(cols.day)]);
    d.setHours(index(cols.hour), index(cols.min), 0, 0);
    return d;
  }

  function open(current) {
    const now = clockNow();
    days = Array.from({ length: DAYS_BACK + DAYS_AHEAD + 1 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() + i - DAYS_BACK);
      return d;
    });
    fill(cols.day, days.map((d) => dayLabel(d, now)));
    fill(cols.hour, Array.from({ length: 24 }, (_, h) => pad(h)));
    fill(cols.min, Array.from({ length: 60 }, (_, m) => pad(m)));
    const date = current?.date ?? now;
    setType(current?.type ?? 'depart');
    el.hidden = false;
    requestAnimationFrame(() => {
      el.classList.add('is-open');
      const dayIdx = days.findIndex((d) => d.toDateString() === date.toDateString());
      scrollToIndex(cols.day, dayIdx < 0 ? DAYS_BACK : dayIdx);
      scrollToIndex(cols.hour, date.getHours());
      scrollToIndex(cols.min, date.getMinutes());
      Object.values(cols).forEach(paint);
    });
  }

  function close() {
    if (el.hidden) return;
    el.classList.remove('is-open');
    setTimeout(() => { el.hidden = true; }, 250);
  }

  el.addEventListener('click', (e) => {
    if (e.target === el) return close(); // tap on the dimmed background
    const t = e.target.closest('[data-type]')?.dataset.type;
    if (t) return setType(t);
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'now') { onDone({ type: 'depart', date: null }); close(); }
    if (act === 'done') { onDone({ type, date: selectedDate() }); close(); }
  });

  return { open, close };
}

// "Depart now", "Depart 17:45", "Arrive by Tomorrow 09:00" …
export function whenLabel(when) {
  if (!when?.date) return 'Depart now';
  const d = when.date;
  const day = dayLabel(d);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const verb = when.type === 'arrive' ? 'Arrive by' : 'Depart';
  return day === 'Today' ? `${verb} ${time}` : `${verb} ${day} ${time}`;
}
