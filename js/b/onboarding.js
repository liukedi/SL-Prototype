// Version B: three intro cards shown when Tourist Mode is first switched on
// (Explore Stockholm → Unique Icons → Easy Exploration). Shown once per browser; ?reset
// shows them again. "Skip All" on the first card closes them.

const KEY = 'sl-proto-onboarding-b';

const STEPS = [
  {
    cls: 'onb--photo',
    title: 'Explore Stockholm: World’s Longest Underground Art Gallery',
    body: '<p>Over <b>90 metro stations</b> feature works by more than <b>150 artists</b>, including sculptures, murals and mosaics, with art styles spanning from the 1950s to the present.</p>',
    skip: true,
    button: 'Next',
  },
  {
    title: 'Unique Icons for Art Metro Stations',
    body: `<ul class="onb__icons">
      <li><img src="icons/b/art-stadion.png" alt=""><p><b>Art Interior:</b> Stations with unique underground design &amp; murals</p></li>
      <li><img src="icons/b/exhibition-hook.png" alt=""><p><b>Art Exhibits:</b> Permanent sculptures, installations &amp; artwork</p></li>
      <li><img src="icons/b/nature-gamla-stan.png" alt=""><p><b>Scenic View:</b> Stations with stunning outdoor lake &amp; city views</p></li>
    </ul>`,
    button: 'Next',
  },
  {
    title: 'Easy Exploration<br>&amp; On-the-way Sightseeing',
    body: `<ol class="onb__list">
      <li>When you open the map, the Explore tab shows art stations near you</li>
      <li>Tap any station to view visiting tips, 360° previews &amp; art stories</li>
      <li>Art stations will be highlighted on your route for casual drop-by visits</li>
    </ol>`,
    button: 'Got it',
  },
];

function seen() {
  try {
    if (new URLSearchParams(location.search).has('reset')) localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === 'done';
  } catch { return false; }
}
let done = seen();

export const onboardingPending = () => !done;

// Shows the cards unless they were already seen.
export function showOnboarding() {
  if (done || document.querySelector('.onb')) return;
  const screen = document.getElementById('screen');
  const el = document.createElement('section');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  screen.appendChild(el);

  let i = 0;
  function render() {
    const s = STEPS[i];
    el.className = `onb ${s.cls ?? ''}`;
    el.setAttribute('aria-label', s.title.replace(/<br>|&amp;/g, (m) => (m === '&amp;' ? '&' : ' ')));
    el.innerHTML = `
      <div class="onb__content">
        <h2>${s.title}</h2>
        ${s.body}
      </div>
      <div class="onb__actions">
        ${s.skip ? '<button type="button" class="onb__skip" data-onb="skip">Skip All</button>' : ''}
        <button type="button" class="onb__btn" data-onb="next">${s.button}</button>
      </div>`;
  }
  function finish() {
    done = true;
    try { localStorage.setItem(KEY, 'done'); } catch { /* ignore */ }
    el.classList.add('is-closing');
    setTimeout(() => el.remove(), 220);
  }
  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-onb]')?.dataset.onb;
    if (act === 'skip') finish();
    if (act === 'next') {
      if (i < STEPS.length - 1) { i += 1; render(); } else finish();
    }
  });
  render();
}
