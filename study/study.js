// Scenario experiment flow (study 2): one page that walks a participant through the session.
//   ?p=P03 → the participant's session; without it, a start screen asks for the code.
//   Order: welcome → background → pre-test intentions → think-aloud → warm-up (version A)
//   → round 1 (version A) → questionnaire → break → round 2 (version B) → questionnaire → interview.
//   Scenario order by participant number (as in the plan): odd = X (Danderyds sjukhus) first,
//   even = Y (Hallonbergen) first. Versions are always A then B and only called
//   "第一个版本" / "第二个版本" on screen.
// Each task is started and finished with a button. Measured per task: time and how often the
// guide 《斯德哥尔摩艺术地铁站介绍》 (external material, not part of the prototype) was opened;
// for T1 also the sightseeing stations saved as favourites in the prototype (round 2 doesn't
// count round 1's) and the one nearest to the user (the expected answer). The warm-up (version A) records nothing; each round reloads the prototype
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
// ?p=P03: formal session of participant 3. ?p=TEST: a test run (order X → Y; nothing is recorded).
const code = (params.get('p') ?? '').toUpperCase();
const isTest = code === 'TEST';
const isFormal = /^P\d{2,}$/.test(code);

const ROUND_NAME = { 1: '第一个版本', 2: '第二个版本' };

function orderFor(p) {
  if (p === 'TEST') return ['X', 'Y'];
  const n = Number(p.replace(/\D/g, ''));
  return n % 2 === 1 ? ['X', 'Y'] : ['Y', 'X'];
}

function buildSteps(order) {
  return [
    { id: 'welcome', label: '开始', kind: 'text' },
    { id: 'background', label: '背景信息', kind: 'survey', survey: 'background', title: '背景信息' },
    { id: 'pretest', label: '意愿测试', kind: 'survey', survey: 'preTest', title: '意愿测试' },
    { id: 'thinkaloud', label: '出声思考', kind: 'text' },
    { id: 'warmup', label: '热身', kind: 'proto', version: 'a' },
    { id: 'round1', label: '第一轮', kind: 'round', round: 1, version: 'a', scenario: order[0] },
    { id: 'q1', label: '问卷', kind: 'survey', survey: 'post', title: '第一个版本 · 测试后问卷', round: 1 },
    { id: 'break', label: '休息', kind: 'text' },
    { id: 'round2', label: '第二轮', kind: 'round', round: 2, version: 'b', scenario: order[1] },
    { id: 'q2', label: '问卷', kind: 'survey', survey: 'post', title: '第二个版本 · 测试后问卷', round: 2 },
    { id: 'interview', label: '访谈', kind: 'text' },
  ];
}

// ---------- state (per participant, survives reloads) ----------
const KEY = `sl-study-${code}`;
// phase (in a round): the task 'T1'…'T3' (not started while taskStart is null), then 'done'.
// times: seconds per task.
// views[round][task] = { opens }: how often the guide was opened.
// saved[round]: T1's sightseeing stations saved as favourites in the prototype.
// warmupStart: when the warm-up began ("完成热身" unlocks after STUDY.warmupMin).
const fresh = () => ({ step: 0, phase: 'T1', taskStart: null, times: { 1: {}, 2: {} }, views: { 1: {}, 2: {} }, doneAt: null, warmupStart: null, saved: { 1: [], 2: [] } });
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
  return (state.views[r][t] ??= { opens: 0 });
}
const opens = (r, t) => state.views[r]?.[t]?.opens ?? 0;
// T1's stations found = sightseeing stations saved as favourites in the prototype (read from its
// storage while T1 is shown; same origin), minus (in round 2) those saved in round 1.
const savedIn = (r) => state.saved?.[r] ?? [];
const found = (r) => {
  const before = r === 2 ? found(1) : [];
  return savedIn(r).filter((k) => !before.includes(k));
};
function readFavourites() {
  const cur = running();
  if (!cur || cur.t !== 'T1') return;
  let favs = [];
  try { favs = JSON.parse(localStorage.getItem(`sl-proto-v1-${steps[state.step].version}`) || '{}').favorites ?? []; } catch { return; }
  const list = favs.filter((k) => specialKeys.has(k));
  if (JSON.stringify(list) === JSON.stringify(savedIn(cur.r))) return;
  state.saved = { ...state.saved, [cur.r]: list };
  save();
  updateFound();
}
const T1_TARGET = 6;
function foundHtml(r) {
  const f = found(r);
  return `<p class="found__count">${esc(TEXT.found(f.length, T1_TARGET))}</p>
    ${f.length ? `<p class="found__list">${esc(f.map(name).join('、'))}</p>` : ''}
    ${r === 2 && savedIn(2).length > f.length ? `<p class="found__note">${esc(TEXT.foundExcluded)}</p>` : ''}`;
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

// The guide, opened from the task cards; every opening is recorded.
const guide = await createGuide({
  note: TEXT.guideNote,
  onOpen: () => { const cur = running(); if (cur) { viewRec(cur.r, cur.t).opens += 1; save(); } },
});
for (const s of guide.stations) specialKeys.add(s.key);


let protoLoadedFor = null; // which step's prototype is in the frame
function loadPrototype(step) {
  const frame = $('#proto');
  if (protoLoadedFor === step.id) return;
  protoLoadedFor = step.id;
  // ?reset: no saved favourites / history / Tourist Mode; the clock restarts at 18:30. Only the
  // first time a step is shown: if this page is reloaded (or the browser reloads the tab after
  // switching away), the prototype keeps the participant's favourites and Tourist Mode.
  const reset = state.protoReset !== step.id;
  if (reset) {
    state.protoReset = step.id;
    save();
    // (?reset clears these too, but only once the frame has loaded: clear now, so the old
    // favourites are never read for the new step.)
    for (const k of ['sl-proto-v1-a', 'sl-proto-v1-b']) try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
  frame.src = `../${step.version}/?${reset ? 'reset&' : ''}study&t=${Date.now()}`;
}

// ---------- rendering ----------
function renderProgress() {
  $('#progress').innerHTML = steps
    .map((s, i) => `<li class="${i < state.step ? 'is-done' : i === state.step ? 'is-current' : ''}">${esc(s.label)}</li>`)
    .join('');
}

const para = (arr) => arr.map((t) => `<p>${esc(t)}</p>`).join('');
const nextBtn = (label = '下一步') => `<button type="button" class="btn btn--primary" data-act="next">${esc(label)}</button>`;

function renderText(step) {
  const body = {
    welcome: `<h1>欢迎参加测试</h1>${para(TEXT.welcome)}${nextBtn('开始')}`,
    thinkaloud: `<h1>出声思考</h1>${para(TEXT.thinkAloud)}<div class="note">${esc(TEXT.thinkAloudExamples)}</div>${nextBtn()}`,
    break: `<h1>休息一下</h1><p>${esc(TEXT.break)}</p>${nextBtn('进入第二轮')}`,
    interview: `<h1>访谈</h1><p>${esc(TEXT.interview)}</p><p class="big">${esc(TEXT.thanks)}</p>`,
  }[step.id];
  return `<section class="card">${body}</section>${step.id === 'interview' ? sessionData() : ''}`;
}

// ---------- the session's data as one table row (same columns as the Google Sheet) ----------
const HEADER = ['记录时间', '编号', '情境顺序',
  ...[1, 2].flatMap((r) => [`${r === 1 ? '第一轮' : '第二轮'}版本`, `${r === 1 ? '第一轮' : '第二轮'}情境`,
    ...TASKS.flatMap((k) => [`R${r} ${k.id} 用时(秒)`, `R${r} ${k.id} 打开资料次数`]),
    `R${r} T1 收藏的站`, `R${r} T1 收藏站数`, `R${r} T1 最近的站（标准答案）`]),
  '数据串'];
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
  setRecordStatus('正在记录到表格…', '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    // no-cors: the answer can't be read, but a network failure still throws.
    await fetch(STUDY.sheetUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ header: HEADER, row: dataRow() }), signal: ctrl.signal });
    state.recorded = true;
    save();
    setRecordStatus('✓ 已自动记录到表格。', 'ok');
  } catch {
    setRecordStatus('没能自动记录（可能是网络无法访问 Google）。请点“下载数据文件”，把文件发给主持人。', 'warn');
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
      : `<td>${mmss(t[k.id])}</td><td>${opens(r, k.id)} 次</td>`)).join('');
    const total = TASKS.reduce((n, k) => n + (t[k.id] ?? 0), 0);
    return `<tr><th>${esc(ROUND_NAME[r])}（${s.version.toUpperCase()}）<br><span class="muted">情境 ${s.scenario} · ${esc(SCENARIOS[s.scenario].destination)}</span></th>${cells}<td>${mmss(total)}</td></tr>`;
  }).join('');
  return `
    <section class="card data-card">
      <h2>本场数据</h2>
      <p>参与者 <b>${esc(code)}</b> · 情境顺序 ${order[0]} → ${order[1]}</p>
      <div class="data-scroll">
        <table class="data">
          <tr><th rowspan="2"></th>${TASKS.map((k) => `<th colspan="2">${esc(k.title)}</th>`).join('')}<th rowspan="2">三个任务合计</th></tr>
          <tr>${TASKS.map(() => '<th>用时</th><th>打开资料</th>').join('')}</tr>
          ${roundRows}
        </table>
      </div>
      <p class="muted">“打开资料”= 任务进行中打开《斯德哥尔摩艺术地铁站介绍》的次数。</p>
      ${t1Summary()}
      <p class="mod-param"><code>${esc(dataParam(2))}</code>
        <button type="button" class="btn btn--small" data-act="mod-copy">复制</button></p>
      <p class="record-status ${state.recorded ? 'ok' : ''}" id="record-status">${isTest
        ? '测试模式：数据不会记录到表格。'
        : state.recorded ? '✓ 已自动记录到表格。' : STUDY.sheetUrl ? '' : '表格地址还没有设置（study/config.js → sheetUrl），请下载数据文件。'}</p>
      <button type="button" class="btn" data-act="download">下载数据文件</button>
    </section>`;
}

// T1 per round: sightseeing stations saved, how many, and the nearest (expected answer).
function t1Summary(rounds = [1, 2]) {
  return `<table class="summary"><tr><th></th><th>任务 1 收藏的站</th><th>最近的站（标准答案）</th></tr>
    ${rounds.map((r) => {
      const f = found(r);
      return `<tr><td>${esc(ROUND_NAME[r])}</td><td>${f.length} 个：${esc(f.map(name).join('、') || '—')}</td>
        <td>${esc(nearest(f) || '—')}</td></tr>`;
    }).join('')}</table>`;
}

function renderSurvey(step) {
  const url = surveyUrl(step);
  const frame = url
    ? `<iframe class="survey__frame" src="${esc(url)}" title="${esc(step.title)}"></iframe>`
    : `<div class="survey__missing">问卷链接还没有设置（study/config.js → questionnaires.${esc(step.survey)}）。<br>
        这里会显示问卷。</div>`;
  return `
    <section class="survey">
      <div class="survey__head">
        <h1>${esc(step.title)}</h1>
        <div class="survey__actions">
          ${url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">在新窗口打开</a>` : ''}
          ${nextBtn('我已提交，下一步')}
        </div>
      </div>
      ${frame}
    </section>`;
}

function renderSide(step) {
  if (step.kind === 'proto') {
    return `<div class="card card--task"><p class="eyebrow">热身</p><p>${esc(TEXT.warmupIntro)}</p>
      <ol class="warmup-list">${TEXT.warmupTasks.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      <p class="warmup-wait" id="warmup-wait"></p>
      <button type="button" class="btn btn--done" data-act="next" id="warmup-done" disabled>完成热身</button></div>`;
  }
  // round
  const sc = SCENARIOS[step.scenario];
  const scenario = `<div class="card card--scenario"><p class="eyebrow">情境 · ${esc(ROUND_NAME[step.round])}</p>${para(sc.text)}</div>`;
  const guideCard = `<div class="card card--guide"><p>${esc(TEXT.guide)}</p>
    <button type="button" class="btn" data-act="guide">打开资料</button></div>`;
  const ph = state.phase;
  if (ph === 'done') {
    const rows = TASKS.map((k) => `<tr><td>${esc(k.title)}</td><td>${mmss(state.times[step.round][k.id] ?? 0)}</td>
      <td>${opens(step.round, k.id)} 次</td></tr>`).join('');
    return `${scenario}<div class="card"><p class="task">${esc(TEXT.roundDone)}</p>
      <table class="summary"><tr><th></th><th>用时</th><th>打开资料</th></tr>${rows}</table>
      ${t1Summary([step.round])}
      <button type="button" class="btn btn--primary" data-act="next" id="to-survey" disabled>去填问卷</button></div>`;
  }
  const task = TASKS.find((t) => t.id === ph);
  const started = state.taskStart != null;
  const doneTasks = TASKS.filter((t) => state.times[step.round][t.id] != null)
    .map((t) => `<li>${esc(t.title)} ✓ <span class="done-time">${mmss(state.times[step.round][t.id])}</span></li>`).join('');
  // Before the round's first task: how the round works, and (version B) Tourist Mode first.
  const intro = task.id === 'T1' && !started
    ? `<div class="card card--intro"><p>${esc(TEXT.roundIntro)}</p></div>
      ${step.version === 'b' ? `<div class="card card--task"><p class="eyebrow">开始前</p><p class="task">${esc(TEXT.touristMode)}</p>
        <p class="tm-status" id="tm-status" hidden>✓ ${esc(TEXT.touristModeOn)}</p></div>` : ''}`
    : '';
  const avoid = task.id === 'T1' && step.round === 2 && found(1).length
    ? `<p class="avoid">${esc(TEXT.avoid)}${esc(found(1).map(name).join('、'))}</p>` : '';
  const foot = started
    ? `<div class="task__foot">
        <span class="timer" id="timer">00:00</span>
        <button type="button" class="btn btn--done" data-act="task-done">完成</button>
      </div>
      <p class="timer-note" id="timer-note" hidden>已超过 ${STUDY.longTaskMin} 分钟</p>`
    : `<div class="task__foot"><span class="muted">准备好后点“开始”</span>
        <button type="button" class="btn btn--primary" data-act="start" ${task.id === 'T1' && step.version === 'b' ? 'disabled' : ''}>开始</button></div>`;
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
  readFavourites();
  const el = $('#timer');
  if (el && state.taskStart) {
    const sec = Math.floor((Date.now() - state.taskStart) / 1000);
    el.textContent = mmss(sec);
    $('#timer-note').hidden = sec < STUDY.longTaskMin * 60;
  }
  // Warm-up: "完成热身" unlocks after STUDY.warmupMin minutes.
  const warmupDone = $('#warmup-done');
  if (warmupDone && state.warmupStart) {
    const left = STUDY.warmupMin * 60 - Math.floor((Date.now() - state.warmupStart) / 1000);
    warmupDone.disabled = left > 0;
    $('#warmup-wait').textContent = left > 0 ? TEXT.warmupWait(mmss(left)) : TEXT.warmupReady;
  }
  // Round summary: "去填问卷" unlocks after STUDY.summaryWaitSec.
  const toSurvey = $('#to-survey');
  if (toSurvey && state.doneAt) {
    const left = STUDY.summaryWaitSec - Math.floor((Date.now() - state.doneAt) / 1000);
    toSurvey.disabled = left > 0;
    toSurvey.textContent = left > 0 ? `去填问卷（${left}）` : '去填问卷';
  }
  // Round 2: task 1's "开始" only once Tourist Mode is on in the prototype (same origin frame).
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
    state.saved = { ...state.saved, [target.round]: [] };
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
    if (i < TASKS.length - 1) state.phase = TASKS[i + 1].id; // the next task waits for "开始"
    else { state.phase = 'done'; state.doneAt = Date.now(); }
    save();
    return render();
  }
  if (act === 'guide') return guide.open();
  if (act === 'mod-go') return go(Number(e.target.closest('[data-step]').dataset.step));
  if (act === 'download') return downloadData();
  if (act === 'mod-copy') {
    navigator.clipboard?.writeText(dataParam(2)).then(() => { e.target.textContent = '已复制'; });
    return;
  }
  if (act === 'mod-reset') {
    if (confirm(`清空 ${code} 的进度和用时，从头开始？`)) { state = fresh(); save(); protoLoadedFor = null; render(); }
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
    ? `${mmss(state.times[r][k])} · 资料 ${opens(r, k)} 次` : '—');
  $('#moderator-body').innerHTML = `
    <p><a class="btn btn--small" href="./">← 返回开始页（选择正式测试 / 测试）</a></p>
    <p><b>${esc(isTest ? '测试' : code)}</b> · 情境顺序 ${order[0]} → ${order[1]}
      （第一轮 ${esc(SCENARIOS[order[0]].destination)}，第二轮 ${esc(SCENARIOS[order[1]].destination)}）</p>
    <table class="mod-table">
      <tr><th></th>${TASKS.map((k) => `<th>${k.id}</th>`).join('')}</tr>
      <tr><td>第一轮 A</td>${TASKS.map((k) => `<td>${t(1, k.id)}</td>`).join('')}</tr>
      <tr><td>第二轮 B</td>${TASKS.map((k) => `<td>${t(2, k.id)}</td>`).join('')}</tr>
    </table>
    <p class="mod-param"><code>${esc(dataParam(2))}</code> <button type="button" class="btn btn--small" data-act="mod-copy">复制</button></p>
    <p>跳到：${steps.map((s, i) => `<button type="button" class="btn btn--small${i === state.step ? ' is-current' : ''}" data-act="mod-go" data-step="${i}">${i + 1} ${esc(s.label)}</button>`).join(' ')}</p>
    <p><button type="button" class="btn btn--small btn--danger" data-act="mod-reset">清空进度</button></p>`;
}

// ---------- start screen: test run, or a formal session with the participant's number ----------
function renderStart() {
  document.body.classList.add('is-start');
  $('#main').innerHTML = `
    <section class="card">
      <h1>情境实验</h1>
      <div class="start-choice">
        <div>
          <h2>正式测试</h2>
          <p class="muted">输入参与者编号（1、2、3…）。结束时数据会记录到表格。</p>
          <form id="start-form" class="start-form">
            <input name="n" type="number" min="1" max="99" placeholder="编号" required aria-label="参与者编号">
            <button class="btn btn--primary">开始正式测试</button>
          </form>
        </div>
        <div>
          <h2>测试</h2>
          <p class="muted">试走流程用，数据不会记录。</p>
          <a class="btn" href="?p=TEST">开始测试</a>
        </div>
      </div>
    </section>`;
  $('#start-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = Number(e.target.n.value);
    if (n >= 1) location.search = `?p=P${String(n).padStart(2, '0')}`;
  });
}

if (isFormal || isTest) {
  $('#participant').textContent = isTest ? '测试' : code;
  document.body.classList.toggle('is-test', isTest);
  render();
} else renderStart();
