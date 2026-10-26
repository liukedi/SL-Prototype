// Scenario experiment flow (study 2): one page that walks a participant through the session.
//   ?p=P03 → the participant's session; without it, a start screen asks for the code.
//   Order: welcome → background → pre-test intentions → think-aloud → warm-up (version A)
//   → round 1 (version A) → questionnaire → break → round 2 (version B) → questionnaire → interview.
//   Scenario order by participant number (as in the plan): odd = X (Danderyds sjukhus) first,
//   even = Y (Hallonbergen) first. Versions are always A then B and only called
//   "Version 1" / "Version 2" on screen.
// Each task is started and finished with a button. Measured per task: time and how often the
// guide "Stockholm Metro Art Guide" (external material, not part of the prototype) was opened;
// for T1 also the art stations found (details opened: the guide in both rounds, the stations'
// pages in version B; round 2 doesn't count round 1's) and the one nearest to the user (the
// expected answer). The warm-up (version A) records nothing; each round reloads the prototype
// with ?reset, so nothing from the warm-up carries over. Formal sessions
// send the data to a Google Sheet at the end (config.js), with a CSV download as fallback.
// Progress is kept in localStorage per participant, so a reload resumes at the same step.
import { STUDY } from './config.js';
import { SCENARIOS, TASKS, TEXT } from './content.js';
import { createGuide } from './guide.js';
import { CONFIG } from '../js/config.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const params = new URLSearchParams(location.search);
// English version (branch study-flow-en): test sessions only, order X → Y, nothing recorded.
const code = 'TEST';
const isTest = true;
const isFormal = false;

const ROUND_NAME = { 1: 'Version 1', 2: 'Version 2' };

function orderFor(p) {
  if (p === 'TEST') return ['X', 'Y'];
  const n = Number(p.replace(/\D/g, ''));
  return n % 2 === 1 ? ['X', 'Y'] : ['Y', 'X'];
}

function buildSteps(order) {
  return [
    { id: 'welcome', label: 'Welcome', kind: 'text' },
    { id: 'background', label: 'Background', kind: 'survey', survey: 'background', title: 'Background' },
    { id: 'pretest', label: 'Intentions', kind: 'survey', survey: 'preTest', title: 'Intentions' },
    { id: 'thinkaloud', label: 'Think aloud', kind: 'text' },
    { id: 'warmup', label: 'Warm-up', kind: 'proto', version: 'a' },
    { id: 'round1', label: 'Round 1', kind: 'round', round: 1, version: 'a', scenario: order[0] },
    { id: 'q1', label: 'Questionnaire', kind: 'survey', survey: 'post', title: 'Version 1 · Post-test questionnaire', round: 1 },
    { id: 'break', label: 'Break', kind: 'text' },
    { id: 'round2', label: 'Round 2', kind: 'round', round: 2, version: 'b', scenario: order[1] },
    { id: 'q2', label: 'Questionnaire', kind: 'survey', survey: 'post', title: 'Version 2 · Post-test questionnaire', round: 2 },
    { id: 'interview', label: 'Interview', kind: 'text' },
  ];
}

// ---------- state (per participant, survives reloads) ----------
const KEY = `sl-study-${code}`;
// phase (in a round): the task 'T1'…'T3' (not started while taskStart is null), then 'done'.
// times: seconds per task.
// views[round][task] = { guide: [keys], app: [keys], opens }: station details viewed in the
// guide / in the app (version B's station pages), and how often the guide was opened.
// warmupStart: when the warm-up began ("Finish warm-up" unlocks after STUDY.warmupMin).
const fresh = () => ({ step: 0, phase: 'T1', taskStart: null, times: { 1: {}, 2: {} }, views: { 1: {}, 2: {} }, doneAt: null, warmupStart: null });
let state = fresh();
try { state = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* storage blocked */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } };

state.views ??= { 1: {}, 2: {} }; // progress saved by an older version of this page
if (state.phase === 'intro') state.phase = 'T1';

const order = code ? orderFor(code) : ['X', 'Y'];
const steps = buildSteps(order);

// ---------- helpers ----------
const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

// e.g. P03_R1_A_X_T1-185s2g_T2-240s0g_T3-300s1g: seconds (s), then guide openings (g) per
// task; round 2 also carries round 1.
function dataParam(uptoRound) {
  const parts = [code];
  for (const r of [1, 2]) {
    if (r > uptoRound) break;
    const s = steps.find((x) => x.round === r && x.kind === 'round');
    const t = state.times[r];
    parts.push(`R${r}`, s.version.toUpperCase(), s.scenario, ...TASKS.map((k) => (t[k.id] == null
      ? `${k.id}-NA` : `${k.id}-${t[k.id]}s${opens(r, k.id)}g`)));
  }
  return parts.join('_');
}

const surveyUrl = (step) => STUDY.questionnaires[step.survey] || '';

// ---------- station details viewed during a task ----------
const name = (key) => key.split('|')[0];
// The task on screen (started or not): details opened while it is shown count for it, so a
// station opened just before pressing "Start" is not lost.
const running = () => {
  const step = steps[state.step];
  return step?.kind === 'round' && TASKS.some((t) => t.id === state.phase) ? { r: step.round, t: state.phase } : null;
};
function viewRec(r, t) {
  state.views[r] ??= {};
  return (state.views[r][t] ??= { guide: [], app: [], opens: 0 });
}
function recordView(source, key) {
  const cur = running();
  if (!cur || !specialKeys.has(key)) return;
  // Version A's station pages have no art details (only departures): there, only the guide counts.
  if (source === 'app' && steps[state.step].version !== 'b') return;
  const rec = viewRec(cur.r, cur.t);
  if (!rec[source].includes(key)) { rec[source].push(key); save(); updateFound(); }
}
// Distinct stations whose details were seen in a task (guide + app).
const viewed = (r, t) => {
  const v = state.views[r]?.[t];
  return v ? [...new Set([...v.guide, ...v.app])] : [];
};
const opens = (r, t) => state.views[r]?.[t]?.opens ?? 0;
// T1's art stations found: those viewed, minus (in round 2) those already found in round 1.
const found = (r) => {
  const before = r === 2 ? found(1) : [];
  return viewed(r, 'T1').filter((k) => !before.includes(k));
};
const T1_TARGET = 6;
function foundHtml(r) {
  const f = found(r);
  return `<p class="found__count">${esc(TEXT.found(f.length, T1_TARGET))}</p>
    ${f.length ? `<p class="found__list">${esc(f.map(name).join(', '))}</p>` : ''}
    ${r === 2 && viewed(2, 'T1').length > f.length ? `<p class="found__note">${esc(TEXT.foundExcluded)}</p>` : ''}`;
}
function updateFound() {
  const el = $('#found');
  const cur = running();
  if (el && cur) el.innerHTML = foundHtml(cur.r);
}

// Station positions (metro entries of the search index) and the user's (fake) position.
let positions = new Map();
const specialKeys = new Set();
fetch('../data/search-index.json').then((r) => r.json()).then(({ stops }) => {
  for (const [n, mun, types, lng, lat] of stops) {
    const key = `${n}|${mun}`;
    if (lng != null && (types.includes('m') || !positions.has(key))) positions.set(key, [lng, lat]);
  }
});
function km([lng1, lat1], [lng2, lat2]) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}
// The viewed station nearest to the user: the expected answer of T1.
function nearest(keys) {
  let best = null;
  for (const k of keys) {
    const p = positions.get(k);
    if (p && (!best || km(CONFIG.userLocation, p) < best.d)) best = { key: k, d: km(CONFIG.userLocation, p) };
  }
  return best ? `${name(best.key)} (${best.d.toFixed(1)} km)` : '';
}

// The guide, opened from the task cards; every opening and station viewed is recorded.
const guide = await createGuide({
  note: TEXT.guideNote,
  onOpen: () => { const cur = running(); if (cur) { viewRec(cur.r, cur.t).opens += 1; save(); } },
  onView: (key) => recordView('guide', key),
});
for (const s of guide.stations) specialKeys.add(s.key);

// Version B in the frame: a station page shown with its details (any stop page: map, search,
// Explore, the journey map) counts as viewed. All three kinds count (art, exhibition, scenic).
// Hooked on every load and re-checked every tick, so a reloaded frame is never missed.
function hookFrame() {
  try {
    const doc = $('#proto').contentDocument;
    if (!doc || doc.slStudyHooked) return;
    doc.slStudyHooked = true;
    doc.addEventListener('sl:stop-page', (e) => {
      const { stop, info } = e.detail ?? {};
      if (stop?.name && info) recordView('app', `${stop.name}|${stop.municipality}`);
    });
  } catch { /* not same origin */ }
}
$('#proto').addEventListener('load', hookFrame);

let protoLoadedFor = null; // which step's prototype is in the frame
function loadPrototype(step) {
  const frame = $('#proto');
  if (protoLoadedFor === step.id) return;
  protoLoadedFor = step.id;
  // ?reset: no saved favourites / history / Tourist Mode; the clock restarts at 18:30. Only the
  // first time a step is shown: if this page is reloaded (or the browser reloads the tab after
  // switching away), the prototype keeps the participant's favourites and Tourist Mode.
  const reset = state.protoReset !== step.id;
  if (reset) { state.protoReset = step.id; save(); }
  frame.src = `../${step.version}/?${reset ? 'reset&' : ''}study&t=${Date.now()}`;
}

// ---------- rendering ----------
function renderProgress() {
  $('#progress').innerHTML = steps
    .map((s, i) => `<li class="${i < state.step ? 'is-done' : i === state.step ? 'is-current' : ''}">${esc(s.label)}</li>`)
    .join('');
}

const para = (arr) => arr.map((t) => `<p>${esc(t)}</p>`).join('');
const nextBtn = (label = 'Next') => `<button type="button" class="btn btn--primary" data-act="next">${esc(label)}</button>`;

function renderText(step) {
  const body = {
    welcome: `<h1>Welcome</h1>${para(TEXT.welcome)}${nextBtn('Begin')}`,
    thinkaloud: `<h1>Thinking aloud</h1>${para(TEXT.thinkAloud)}<div class="note">${esc(TEXT.thinkAloudExamples)}</div>${nextBtn()}`,
    break: `<h1>Break</h1><p>${esc(TEXT.break)}</p>${nextBtn('Go to round 2')}`,
    interview: `<h1>Interview</h1><p>${esc(TEXT.interview)}</p><p class="big">${esc(TEXT.thanks)}</p>`,
  }[step.id];
  return `<section class="card">${body}</section>${step.id === 'interview' ? sessionData() : ''}`;
}

// ---------- the session's data as one table row (same columns as the Google Sheet) ----------
const HEADER = ['Recorded', 'Participant', 'Scenario order',
  ...[1, 2].flatMap((r) => [`R${r} version`, `R${r} scenario`,
    ...TASKS.flatMap((k) => [`R${r} ${k.id} time (s)`, `R${r} ${k.id} guide openings`]),
    `R${r} T1 stations found`, `R${r} T1 number found`, `R${r} T1 nearest station (expected answer)`]),
  'Data string'];
function dataRow() {
  const row = [new Date().toLocaleString('sv-SE'), code, `${order[0]}→${order[1]}`];
  for (const r of [1, 2]) {
    const s = steps.find((x) => x.round === r && x.kind === 'round');
    const t = state.times[r];
    row.push(s.version.toUpperCase(), `${s.scenario} ${SCENARIOS[s.scenario].destination}`);
    for (const k of TASKS) row.push(t[k.id] ?? '', t[k.id] == null ? '' : opens(r, k.id));
    const f = found(r);
    row.push(f.map(name).join(' / '), f.length, nearest(f));
  }
  row.push(dataParam(2));
  return row;
}

// Formal sessions only: send the row to the Google Sheet once (Apps Script web app). Google is
// blocked in mainland China without a VPN, so a failure is normal there: the download button
// is the fallback.
async function recordToSheet() {
  if (!isFormal || state.recorded || !STUDY.sheetUrl) return;
  setRecordStatus('Recording to the sheet…', '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    // no-cors: the answer can't be read, but a network failure still throws.
    await fetch(STUDY.sheetUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ header: HEADER, row: dataRow() }), signal: ctrl.signal });
    state.recorded = true;
    save();
    setRecordStatus('✓ Recorded to the sheet.', 'ok');
  } catch {
    setRecordStatus('Could not record automatically. Please press “Download data file” and send the file to the moderator.', 'warn');
  } finally {
    clearTimeout(timer);
  }
}
function setRecordStatus(text, kind) {
  const el = $('#record-status');
  if (!el) return;
  el.textContent = text;
  el.className = `record-status ${kind}`;
}

function downloadData() {
  const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = `\uFEFF${[HEADER, dataRow()].map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`; // BOM: Excel opens UTF-8
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `SL-study-${code}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// All measured data of the session, shown on the last page for the moderator to note down.
function sessionData() {
  const roundRows = [1, 2].map((r) => {
    const s = steps.find((x) => x.round === r && x.kind === 'round');
    const t = state.times[r];
    const cells = TASKS.map((k) => (t[k.id] == null ? '<td>—</td><td>—</td>'
      : `<td>${mmss(t[k.id])}</td><td>${opens(r, k.id)}×</td>`)).join('');
    const total = TASKS.reduce((n, k) => n + (t[k.id] ?? 0), 0);
    return `<tr><th>${esc(ROUND_NAME[r])}(${s.version.toUpperCase()})<br><span class="muted">Scenario ${s.scenario} · ${esc(SCENARIOS[s.scenario].destination)}</span></th>${cells}<td>${mmss(total)}</td></tr>`;
  }).join('');
  return `
    <section class="card data-card">
      <h2>Session data</h2>
      <p>Participant <b>${esc(code)}</b> · scenario order ${order[0]} → ${order[1]}</p>
      <div class="data-scroll">
        <table class="data">
          <tr><th rowspan="2"></th>${TASKS.map((k) => `<th colspan="2">${esc(k.title)}</th>`).join('')}<th rowspan="2">All three tasks</th></tr>
          <tr>${TASKS.map(() => '<th>Time</th><th>Guide</th>').join('')}</tr>
          ${roundRows}
        </table>
      </div>
      <p class="muted">“Guide” = how often the “Stockholm Metro Art Guide” was opened during the task.</p>
      ${t1Summary()}
      <p class="mod-param"><code>${esc(dataParam(2))}</code>
        <button type="button" class="btn btn--small" data-act="mod-copy">Copy</button></p>
      <p class="record-status ${state.recorded ? 'ok' : ''}" id="record-status">${isTest
        ? 'Test mode: the data is not recorded to the sheet.'
        : state.recorded ? '✓ Recorded to the sheet.' : STUDY.sheetUrl ? '' : 'The sheet address is not set (study/config.js → sheetUrl); please download the data file.'}</p>
      <button type="button" class="btn" data-act="download">Download data file</button>
    </section>`;
}

// T1 per round: art stations found, how many, and the nearest (expected answer).
function t1Summary(rounds = [1, 2]) {
  return `<table class="summary"><tr><th></th><th>Task 1 stations found</th><th>Nearest (expected answer)</th></tr>
    ${rounds.map((r) => {
      const f = found(r);
      return `<tr><td>${esc(ROUND_NAME[r])}</td><td>${f.length}: ${esc(f.map(name).join(', ') || '—')}</td>
        <td>${esc(nearest(f) || '—')}</td></tr>`;
    }).join('')}</table>`;
}

function renderSurvey(step) {
  const url = surveyUrl(step);
  const frame = url
    ? `<iframe class="survey__frame" src="${esc(url)}" title="${esc(step.title)}"></iframe>`
    : `<div class="survey__missing">The questionnaire link is not set (study/config.js → questionnaires.${esc(step.survey)}).<br>
        The questionnaire will appear here.</div>`;
  return `
    <section class="survey">
      <div class="survey__head">
        <h1>${esc(step.title)}</h1>
        <div class="survey__actions">
          ${url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Open in a new window</a>` : ''}
          ${nextBtn('I have submitted it · Next')}
        </div>
      </div>
      ${frame}
    </section>`;
}

function renderSide(step) {
  if (step.kind === 'proto') {
    return `<div class="card card--task"><p class="eyebrow">Warm-up</p><p>${esc(TEXT.warmupIntro)}</p>
      <ol class="warmup-list">${TEXT.warmupTasks.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      <p class="warmup-wait" id="warmup-wait"></p>
      <button type="button" class="btn btn--done" data-act="next" id="warmup-done" disabled>Finish warm-up</button></div>`;
  }
  // round
  const sc = SCENARIOS[step.scenario];
  const scenario = `<div class="card card--scenario"><p class="eyebrow">Scenario · ${esc(ROUND_NAME[step.round])}</p>${para(sc.text)}</div>`;
  const guideCard = `<div class="card card--guide"><p>${esc(TEXT.guide)}</p>
    <button type="button" class="btn" data-act="guide">Open guide</button></div>`;
  const ph = state.phase;
  if (ph === 'done') {
    const rows = TASKS.map((k) => `<tr><td>${esc(k.title)}</td><td>${mmss(state.times[step.round][k.id] ?? 0)}</td>
      <td>${opens(step.round, k.id)}×</td></tr>`).join('');
    return `${scenario}<div class="card"><p class="task">${esc(TEXT.roundDone)}</p>
      <table class="summary"><tr><th></th><th>Time</th><th>Guide opened</th></tr>${rows}</table>
      ${t1Summary([step.round])}
      <button type="button" class="btn btn--primary" data-act="next" id="to-survey" disabled>Go to the questionnaire</button></div>`;
  }
  const task = TASKS.find((t) => t.id === ph);
  const started = state.taskStart != null;
  const doneTasks = TASKS.filter((t) => state.times[step.round][t.id] != null)
    .map((t) => `<li>${esc(t.title)} ✓ <span class="done-time">${mmss(state.times[step.round][t.id])}</span></li>`).join('');
  // Before the round's first task: how the round works, and (version B) Tourist Mode first.
  const intro = task.id === 'T1' && !started
    ? `<div class="card card--intro"><p>${esc(TEXT.roundIntro)}</p></div>
      ${step.version === 'b' ? `<div class="card card--task"><p class="eyebrow">Before you start</p><p class="task">${esc(TEXT.touristMode)}</p>
        <p class="tm-status" id="tm-status" hidden>✓ ${esc(TEXT.touristModeOn)}</p></div>` : ''}`
    : '';
  const avoid = task.id === 'T1' && step.round === 2 && found(1).length
    ? `<p class="avoid">${esc(TEXT.avoid)}${esc(found(1).map(name).join(', '))}</p>` : '';
  const foot = started
    ? `<div class="task__foot">
        <span class="timer" id="timer">00:00</span>
        <button type="button" class="btn btn--done" data-act="task-done">Done</button>
      </div>
      <p class="timer-note" id="timer-note" hidden>Over ${STUDY.longTaskMin} minutes</p>`
    : `<div class="task__foot"><span class="muted">Press “Start” when you are ready</span>
        <button type="button" class="btn btn--primary" data-act="start" ${task.id === 'T1' && step.version === 'b' ? 'disabled' : ''}>Start</button></div>`;
  return `${scenario}
    ${doneTasks ? `<ul class="done-list">${doneTasks}</ul>` : ''}
    ${intro}
    <div class="card card--task">
      <p class="eyebrow">${esc(task.title)}</p>
      <p class="task">${esc(task.text(step.round))}</p>
      ${avoid}
      ${task.id === 'T1' ? `<div class="found" id="found">${foundHtml(step.round)}</div>` : ''}
      ${foot}
    </div>
    ${guideCard}`;
}

function render() {
  const step = steps[state.step];
  renderProgress();
  const withProto = step.kind === 'proto' || step.kind === 'round';
  document.body.classList.toggle('has-proto', withProto);
  if (withProto) {
    loadPrototype(step);
    $('#side').innerHTML = renderSide(step);
    $('#main').innerHTML = '';
  } else {
    $('#side').innerHTML = '';
    $('#main').innerHTML = step.kind === 'survey' ? renderSurvey(step) : renderText(step);
  }
  if (step.kind === 'proto' && !state.warmupStart) { state.warmupStart = Date.now(); save(); }
  renderModerator();
  tick();
  if (step.id === 'interview') recordToSheet();
}

// ---------- task timer ----------
function tick() {
  hookFrame();
  const el = $('#timer');
  if (el && state.taskStart) {
    const sec = Math.floor((Date.now() - state.taskStart) / 1000);
    el.textContent = mmss(sec);
    $('#timer-note').hidden = sec < STUDY.longTaskMin * 60;
  }
  // Warm-up: "Finish warm-up" unlocks after STUDY.warmupMin minutes.
  const warmupDone = $('#warmup-done');
  if (warmupDone && state.warmupStart) {
    const left = STUDY.warmupMin * 60 - Math.floor((Date.now() - state.warmupStart) / 1000);
    warmupDone.disabled = left > 0;
    $('#warmup-wait').textContent = left > 0 ? TEXT.warmupWait(mmss(left)) : TEXT.warmupReady;
  }
  // Round summary: "Go to the questionnaire" unlocks after STUDY.summaryWaitSec.
  const toSurvey = $('#to-survey');
  if (toSurvey && state.doneAt) {
    const left = STUDY.summaryWaitSec - Math.floor((Date.now() - state.doneAt) / 1000);
    toSurvey.disabled = left > 0;
    toSurvey.textContent = left > 0 ? `Go to the questionnaire (${left})` : 'Go to the questionnaire';
  }
  // Round 2: task 1's "Start" only once Tourist Mode is on in the prototype (same origin frame).
  const status = $('#tm-status');
  if (status) {
    let on = false;
    try { on = $('#proto').contentDocument?.documentElement.dataset.tourist === 'on'; } catch { /* not loaded */ }
    status.hidden = !on;
    $('[data-act="start"]').disabled = !on;
  }
}
setInterval(tick, 500);

// ---------- actions ----------
function go(stepIndex) {
  state.step = Math.max(0, Math.min(steps.length - 1, stepIndex));
  state.phase = 'T1';
  state.taskStart = null;
  const target = steps[state.step];
  state.protoReset = null; // the step's prototype starts fresh
  protoLoadedFor = null;
  if (target.kind === 'round') { // entering a round: it starts clean
    state.times[target.round] = {};
    state.views[target.round] = {};
  }
  if (steps[state.step].kind === 'proto') state.warmupStart = null; // (re)entering the warm-up restarts its clock
  save();
  render();
  window.scrollTo(0, 0);
}


document.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const step = steps[state.step];
  if (act === 'next') return go(state.step + 1);
  if (act === 'start') {
    // (Views and guide openings since the task was shown are kept; the round's data are
    // cleared when the round is entered, see go().)
    state.taskStart = Date.now();
    save();
    return render();
  }
  if (act === 'task-done') {
    const sec = Math.round((Date.now() - state.taskStart) / 1000);
    state.times[step.round][state.phase] = sec;
    state.taskStart = null;
    const i = TASKS.findIndex((t) => t.id === state.phase);
    if (i < TASKS.length - 1) state.phase = TASKS[i + 1].id; // the next task waits for "Start"
    else { state.phase = 'done'; state.doneAt = Date.now(); }
    save();
    return render();
  }
  if (act === 'guide') return guide.open();
  if (act === 'mod-go') return go(Number(e.target.closest('[data-step]').dataset.step));
  if (act === 'download') return downloadData();
  if (act === 'mod-copy') {
    navigator.clipboard?.writeText(dataParam(2)).then(() => { e.target.textContent = 'Copied'; });
    return;
  }
  if (act === 'mod-reset') {
    if (confirm(`Clear ${code}'s progress and times and start over?`)) { state = fresh(); save(); protoLoadedFor = null; render(); }
  }
});

// ---------- progress control panel (collapsed by default; a click elsewhere closes it) ----------
document.addEventListener('click', (e) => {
  const panel = $('.moderator');
  if (panel.open && !panel.contains(e.target)) panel.open = false;
});
// Clicks inside the prototype frame don't reach this page; focus moving into it does.
window.addEventListener('blur', () => {
  setTimeout(() => { if (document.activeElement === $('#proto')) $('.moderator').open = false; });
});
function renderModerator() {
  const t = (r, k) => (state.times[r][k] != null
    ? `${mmss(state.times[r][k])} · guide ${opens(r, k)}×` : '—');
  $('#moderator-body').innerHTML = `
    <p><b>Test session</b> · scenario order ${order[0]} → ${order[1]}
      (round 1 ${esc(SCENARIOS[order[0]].destination)}, round 2 ${esc(SCENARIOS[order[1]].destination)})</p>
    <table class="mod-table">
      <tr><th></th>${TASKS.map((k) => `<th>${k.id}</th>`).join('')}</tr>
      <tr><td>Round 1 A</td>${TASKS.map((k) => `<td>${t(1, k.id)}</td>`).join('')}</tr>
      <tr><td>Round 2 B</td>${TASKS.map((k) => `<td>${t(2, k.id)}</td>`).join('')}</tr>
    </table>
    <p class="mod-param"><code>${esc(dataParam(2))}</code> <button type="button" class="btn btn--small" data-act="mod-copy">Copy</button></p>
    <p>Jump to: ${steps.map((s, i) => `<button type="button" class="btn btn--small${i === state.step ? ' is-current' : ''}" data-act="mod-go" data-step="${i}">${i + 1} ${esc(s.label)}</button>`).join(' ')}</p>
    <p><button type="button" class="btn btn--small btn--danger" data-act="mod-reset">Clear progress</button></p>`;
}

// English version: test sessions only (nothing is recorded to the sheet).
$('#participant').textContent = 'Test';
document.body.classList.add('is-test');
render();
