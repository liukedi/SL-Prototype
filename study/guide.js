// "斯德哥尔摩艺术地铁站介绍": the reading material for the scenario experiment (external, not
// part of the prototype). Same stations and texts as version B's Tourist Mode (data/b/*.json),
// shown as a full-screen list → detail overlay inside the experiment page (same window, so screen sharing records it). Stations are
// sorted alphabetically within each type, so the order gives no hint about distance.
// Reports each opening and each station whose details are viewed (for the task data).

const DATA = '../data/b/';
const TYPES = [
  { id: 'art', label: 'Art Interior', zh: '艺术站（永久艺术）' },
  { id: 'exhibition', label: 'Art Exhibits', zh: '展览站（轮换展览）' },
  { id: 'nature', label: 'Scenic View', zh: '风景站（出站看风景）' },
];
const COMPLEXITY = { 1: 'Easy', 2: 'Medium', 3: 'Complex' };
const BEST = { any: 'Any time', daylight: 'Daylight', sunset: 'Sunset' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nameOf = (key) => key.split('|')[0];

export async function createGuide({ note = '', onOpen, onView } = {}) {
  const [special, info, exhibitions, scenic] = await Promise.all(
    ['special-stations', 'station-info', 'exhibitions', 'scenic'].map((f) => fetch(`${DATA}${f}.json`).then((r) => r.json())),
  );
  const stations = special.stations.map((s) => ({
    ...s,
    name: nameOf(s.key),
    data: (s.category === 'art' ? info : s.category === 'exhibition' ? exhibitions : scenic).stations[s.key],
  })).filter((s) => s.data);

  const el = document.createElement('section');
  el.className = 'guide';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', '斯德哥尔摩艺术地铁站介绍');
  el.hidden = true;
  document.body.appendChild(el);

  const lines = (ls) => (ls ?? []).map((l) => `<span class="g-line g-line--${l >= 17 ? 'green' : l >= 13 ? 'red' : 'blue'}">${l}</span>`).join('');
  const photoDir = (s) => (s.category === 'art' ? 'stations' : s.category === 'exhibition' ? 'exhibitions' : 'scenic');

  function listHtml() {
    return TYPES.map((t) => {
      const items = stations.filter((s) => s.category === t.id).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
      return `<h3 class="g-type">${esc(t.label)} <span>${esc(t.zh)}</span></h3>
        <div class="g-grid">${items.map((s) => `
          <button type="button" class="g-item" data-key="${esc(s.key)}">
            <img src="../assets/b/${photoDir(s)}/${esc(s.data.photo)}" alt="" loading="lazy">
            <span class="g-item__name">${esc(s.name)}</span>
            <span class="g-item__desc">${esc(s.data.description)}</span>
          </button>`).join('')}</div>`;
    }).join('');
  }

  function detailHtml(s) {
    const d = s.data;
    const facts = [['Line', lines(d.lines)]];
    let extra = '';
    if (s.category === 'art') {
      facts.push(['Duration', esc(d.duration)], ['Complexity', esc(COMPLEXITY[d.complexity] ?? '')]);
      extra = d.tip ? `<h4>What to look for</h4><p>${esc(d.tip)}</p>` : '';
    } else if (s.category === 'exhibition') {
      facts.push(['Duration', esc(d.duration)], ['On view', esc(d.period)]);
      extra = `<h4>About the exhibition</h4><p><b>${esc(d.title)}</b> · ${esc(d.artist)}</p><p>${esc(d.about)}</p>`;
    } else {
      const m = d.walk.meters;
      facts.push(['Walk', `${d.walk.minutes} min · ${m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`}`], ['Best time', esc(BEST[d.best] ?? '')]);
      extra = `<h4>How to get there</h4><ol>${d.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        <p class="g-muted">Viewpoint: ${esc(d.viewpoint)} · stay ${esc(d.stay)}</p>`;
    }
    return `
      <button type="button" class="g-back" data-g="back">← 返回列表</button>
      <article class="g-detail">
        <img class="g-detail__photo" src="../assets/b/${photoDir(s)}/${esc(d.photo)}" alt="${esc(s.name)}">
        <div>
          <p class="g-detail__type">${esc(TYPES.find((t) => t.id === s.category).label)}</p>
          <h2>${esc(s.name)}</h2>
          <p>${esc(d.description)}</p>
          <dl class="g-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
          ${extra}
        </div>
      </article>`;
  }

  const body = () => el.querySelector('.guide__body');
  function showList() {
    body().innerHTML = listHtml();
    body().scrollTop = 0;
  }
  function showDetail(key) {
    const s = stations.find((x) => x.key === key);
    if (!s) return;
    body().innerHTML = detailHtml(s);
    body().scrollTop = 0;
    onView?.(key);
  }

  el.innerHTML = `
    <div class="guide__panel">
      <header class="guide__head">
        <div><h2>斯德哥尔摩艺术地铁站介绍</h2>${note ? `<p class="guide__note">${esc(note)}</p>` : ''}</div>
        <button type="button" class="btn" data-g="close">关闭</button>
      </header>
      <div class="guide__body"></div>
    </div>`;
  el.addEventListener('click', (e) => {
    const g = e.target.closest('[data-g]')?.dataset.g;
    if (g === 'close') return close();
    if (g === 'back') return showList();
    const item = e.target.closest('.g-item');
    if (item) showDetail(item.dataset.key);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) close(); });

  function open() {
    showList();
    el.hidden = false;
    onOpen?.();
  }
  function close() { el.hidden = true; }

  return { open, close, stations };
}
