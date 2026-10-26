// Small message card on the phone screen, e.g. for features not built in the prototype.
// Closes by itself after `ms` (default 5 s) or with its × button.
export const NOT_BUILT = 'This feature is not available in the prototype.';

let current = null;

export function showToast(text, ms = 5000) {
  current?.close();
  const screen = document.getElementById('screen');
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <p></p>
    <button type="button" class="toast__close" aria-label="Close">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m2 2 10 10M12 2 2 12"/></svg>
    </button>
    <span class="toast__bar" style="animation-duration:${ms}ms"></span>`;
  el.querySelector('p').textContent = text;
  screen.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));

  const timer = setTimeout(close, ms);
  function close() {
    clearTimeout(timer);
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 250);
    if (current?.el === el) current = null;
  }
  el.querySelector('.toast__close').addEventListener('click', close);
  current = { el, close };
}
