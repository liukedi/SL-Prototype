// Simulated iOS keyboard (dark mode, iPhone 15 Pro). Geometry in screen pt, measured
// from an iOS screenshot. Letters type; shift is one-shot; backspace repeats when held;
// the search key acts as Enter. 123 / emoji / globe / mic are visual only.

const H = 327; // keyboard height incl. home-indicator area
const SIDE = 6.5;
const GAP = 6;
const KEY_W = (393 - 2 * SIDE - 9 * GAP) / 10; // ≈ 32.6
const KEY_H = 42;
const ROW_Y = [52, 106, 160, 213];

const ICONS = {
  shift: '<svg width="22" height="20" viewBox="0 0 22 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M11 2 2 11h4.6v6.5h8.8V11H20z"/></svg>',
  shiftOn: '<svg width="22" height="20" viewBox="0 0 22 20" fill="currentColor" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M11 2 2 11h4.6v6.5h8.8V11H20z"/></svg>',
  backspace: '<svg width="26" height="19" viewBox="0 0 26 19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M8 1.5h15a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H8L1.5 9.5z"/><path d="m12 6 7 7M19 6l-7 7"/></svg>',
  emoji: '<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="currentColor"/><circle cx="8.6" cy="9.4" r="1.4" fill="#454648"/><circle cx="15.4" cy="9.4" r="1.4" fill="#454648"/><path d="M6.8 13.2h10.4a5.2 5.2 0 0 1-10.4 0z" fill="#454648"/></svg>',
  search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>',
  globe: '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="15" cy="15" r="12"/><ellipse cx="15" cy="15" rx="5.2" ry="12"/><path d="M3 15h24M5 8.5h20M5 21.5h20M15 3v24"/></svg>',
  mic: '<svg width="22" height="30" viewBox="0 0 22 30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="6.5" y="2" width="9" height="16" rx="4.5"/><path d="M2.5 13.5a8.5 8.5 0 0 0 17 0M11 22v5M6.5 27.5h9"/></svg>',
};

function rowLayout() {
  const keys = [];
  const letterRow = (letters, y, x0) =>
    [...letters].forEach((ch, i) => keys.push({ type: 'char', ch, x: x0 + i * (KEY_W + GAP), y, w: KEY_W }));
  letterRow('qwertyuiop', ROW_Y[0], SIDE);
  letterRow('asdfghjkl', ROW_Y[1], SIDE + (KEY_W + GAP) / 2);
  keys.push({ type: 'shift', x: SIDE, y: ROW_Y[2], w: 44 });
  letterRow('zxcvbnm', ROW_Y[2], (393 - (7 * KEY_W + 6 * GAP)) / 2);
  keys.push({ type: 'backspace', x: 393 - SIDE - 44, y: ROW_Y[2], w: 44 });
  keys.push({ type: 'noop', label: '123', x: SIDE, y: ROW_Y[3], w: 42 });
  keys.push({ type: 'noop', icon: 'emoji', x: SIDE + 48, y: ROW_Y[3], w: 42 });
  keys.push({ type: 'space', x: SIDE + 96, y: ROW_Y[3], w: 393 - 2 * SIDE - 96 - 91 - GAP });
  keys.push({ type: 'enter', x: 393 - SIDE - 91, y: ROW_Y[3], w: 91 });
  return keys;
}

export function createKeyboard({ onInput, onBackspace, onEnter }) {
  const el = document.createElement('div');
  el.className = 'ios-kb';
  el.style.height = `${H}px`;
  el.setAttribute('aria-hidden', 'true');

  const pop = document.createElement('div');
  pop.className = 'ios-kb__pop';
  const byChar = new Map();
  let shift = false;
  let enterKey;

  for (const k of rowLayout()) {
    const b = document.createElement('div');
    b.className = `ios-kb__key ios-kb__key--${k.type}`;
    Object.assign(b.style, { left: `${k.x}px`, top: `${k.y}px`, width: `${k.w}px`, height: `${KEY_H}px` });
    if (k.type === 'char') { b.textContent = k.ch; byChar.set(k.ch, b); }
    else if (k.type === 'shift') b.innerHTML = ICONS.shift;
    else if (k.type === 'backspace') b.innerHTML = ICONS.backspace;
    else if (k.type === 'enter') { b.innerHTML = ICONS.search; enterKey = b; }
    else if (k.icon) b.innerHTML = ICONS[k.icon];
    else if (k.label) b.textContent = k.label;
    b.dataset.type = k.type;
    if (k.ch) b.dataset.ch = k.ch;
    el.appendChild(b);
  }
  if (byChar.has(' ') === false) byChar.set(' ', el.querySelector('.ios-kb__key--space'));
  for (const [icon, x] of [['globe', 42], ['mic', 350]]) {
    const b = document.createElement('div');
    b.className = 'ios-kb__aux';
    b.innerHTML = ICONS[icon];
    b.style.left = `${x - 22}px`;
    el.appendChild(b);
  }
  el.appendChild(pop);

  function setShift(on) {
    shift = on;
    el.classList.toggle('is-shift', on);
    el.querySelector('.ios-kb__key--shift').innerHTML = on ? ICONS.shiftOn : ICONS.shift;
    for (const [ch, b] of byChar) if (ch !== ' ') b.textContent = on ? ch.toUpperCase() : ch;
  }

  function showPop(key) {
    pop.textContent = key.textContent;
    const x = parseFloat(key.style.left) + parseFloat(key.style.width) / 2;
    pop.style.left = `${x}px`;
    pop.style.top = `${parseFloat(key.style.top)}px`;
    pop.classList.add('is-visible');
  }

  let repeat = null;
  const stopRepeat = () => { clearTimeout(repeat); clearInterval(repeat); repeat = null; };

  function press(key) {
    const type = key.dataset.type;
    if (type === 'char') {
      onInput(shift ? key.dataset.ch.toUpperCase() : key.dataset.ch);
      if (shift) setShift(false);
    } else if (type === 'space') onInput(' ');
    else if (type === 'shift') setShift(!shift);
    else if (type === 'enter') onEnter();
  }

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // keep the press inside the keyboard (no text selection / focus moves)
    const key = e.target.closest('.ios-kb__key, .ios-kb__aux');
    if (!key) return;
    key.classList.add('is-pressed');
    if (key.dataset.type === 'char') showPop(key);
    if (key.dataset.type === 'backspace') {
      onBackspace();
      repeat = setTimeout(() => { repeat = setInterval(onBackspace, 80); }, 420);
    }
    const release = (ev) => {
      key.classList.remove('is-pressed');
      pop.classList.remove('is-visible');
      stopRepeat();
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      if (ev.type === 'pointerup' && key.dataset.type !== 'backspace' && key.contains(document.elementFromPoint(ev.clientX, ev.clientY))) press(key);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  });

  return {
    el,
    height: H,
    get visible() { return el.classList.contains('is-visible'); },
    show() { el.classList.add('is-visible'); },
    hide() { el.classList.remove('is-visible'); setShift(false); stopRepeat(); },
    setEnterEnabled(on) { enterKey.classList.toggle('is-enabled', on); },
    // Briefly highlight the on-screen key for a physical key press.
    flash(name) {
      const key = name === 'Backspace' ? el.querySelector('.ios-kb__key--backspace')
        : name === 'Enter' ? enterKey
        : byChar.get(name.toLowerCase());
      if (!key) return;
      key.classList.add('is-pressed');
      setTimeout(() => key.classList.remove('is-pressed'), 110);
    },
  };
}
