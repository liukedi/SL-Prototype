// Scenario experiment flow (study 2): one page that walks a participant through the session.
//   ?p=P03 → the participant's session; without it, a start screen asks for the code.
//   Order: welcome → background → pre-test intentions → think-aloud → warm-up (version A)
//   → round 1 (version A) → questionnaire → break → round 2 (version B) → questionnaire → interview.
//   Scenario order by participant number (as in the plan): odd = X (Mörby centrum) first,
//   even = Y (Solna centrum) first. Versions are always A then B and only called
//   "第一个版本" / "第二个版本" on screen.
// Task times are measured here and passed to the questionnaires as a URL parameter
// (config.js), so no database is needed. Progress is kept in localStorage per participant,
// so an accidental reload resumes at the same step.
import { STUDY } from './config.js';
import { SCENARIOS, TASKS, TEXT } from './content.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const params = new URLSearchParams(location.search);
const code = (params.get('p') ?? '').toUpperCase();

const ROUND_NAME = { 1: '第一个版本', 2: '第二个版本' };

function orderFor(p) {
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
// times: seconds per task; away: { switches, sec } = leaving this page (another browser tab
// or window) during the task, e.g. to search.
const fresh = () => ({ step: 0, phase: 'intro', taskStart: null, times: { 1: {}, 2: {} }, away: { 1: {}, 2: {} }, cur: null, doneAt: null });
let state = fresh();
try { state = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* storage blocked */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } };

const order = code ? orderFor(code) : ['X', 'Y'];
const steps = buildSteps(order);

// ---------- helpers ----------
const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

// e.g. P03_R1_A_X_T1-185s2a40_T2-240s0a0_T3-300s1a15: seconds, then tab switches (s) and
// seconds away (a) per task; round 2 also carries round 1.
function dataParam(uptoRound) {
  const parts = [code];
  for (const r of [1, 2]) {
    if (r > uptoRound) break;
    const s = steps.find((x) => x.round === r && x.kind === 'round');
    const t = state.times[r];
    const a = state.away[r] ?? {};
    parts.push(`R${r}`, s.version.toUpperCase(), s.scenario, ...TASKS.map((k) => (t[k.id] == null
      ? `${k.id}-NA` : `${k.id}-${t[k.id]}s${a[k.id]?.switches ?? 0}a${a[k.id]?.sec ?? 0}`)));
  }
  return parts.join('_');
}

function surveyUrl(step) {
  const base = STUDY.questionnaires[step.survey];
  if (!base) return '';
  const u = new URL(base, location.href);
  u.searchParams.set(STUDY.paramName, step.round ? dataParam(step.round) : code);
  return u.href;
}

let protoLoadedFor = null; // which step's prototype is in the frame
function loadPrototype(step) {
  const frame = $('#proto');
  if (protoLoadedFor === step.id) return;
  protoLoadedFor = step.id;
  // ?reset: no saved favourites / history / Tourist Mode; the clock restarts at 18:30.
  frame.src = `../${step.version}/?reset&study&t=${Date.now()}`;
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
  return `<section class="card">${body}</section>`;
}

function renderSurvey(step) {
  const url = surveyUrl(step);
  const frame = url
    ? `<iframe class="survey__frame" src="${esc(url)}" title="${esc(step.title)}"></iframe>`
    : `<div class="survey__missing">问卷链接还没有设置（study/config.js → questionnaires.${esc(step.survey)}）。<br>
        这里会显示问卷，并带上参数：<code>${esc(STUDY.paramName)}=${esc(step.round ? dataParam(step.round) : code)}</code></div>`;
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
    return `<div class="card"><p class="eyebrow">热身</p><p class="task">${esc(TEXT.warmup)}</p>
      <p class="muted">${esc(TEXT.warmupNote)}</p>${nextBtn('完成热身')}</div>`;
  }
  // round
  const sc = SCENARIOS[step.scenario];
  const scenario = `<div class="card card--scenario"><p class="eyebrow">情境 · ${esc(ROUND_NAME[step.round])}</p><p>${esc(sc.text)}</p></div>`;
  const ph = state.phase;
  if (ph === 'intro') {
    const gate = step.version === 'b'
      ? `<div class="card card--task"><p class="eyebrow">开始前</p><p class="task">${esc(TEXT.touristMode)}</p>
          <p class="tm-status" id="tm-status" hidden>✓ ${esc(TEXT.touristModeOn)}</p></div>`
      : '';
    return `${scenario}${gate}<div class="card"><p class="muted">${esc(TEXT.search)}</p>
      <button type="button" class="btn btn--primary" data-act="start" ${step.version === 'b' ? 'disabled' : ''}>开始任务</button></div>`;
  }
  if (ph === 'verify') {
    return `${scenario}<div class="card"><p class="task">${esc(TEXT.verify)}</p>
      <button type="button" class="btn btn--primary" data-act="after-verify">继续</button></div>`;
  }
  if (ph === 'done') {
    const a = state.away[step.round];
    const rows = TASKS.map((k) => `<tr><td>${esc(k.title)}</td><td>${mmss(state.times[step.round][k.id] ?? 0)}</td>
      <td>${a[k.id]?.switches ?? 0} 次 · ${mmss(a[k.id]?.sec ?? 0)}</td></tr>`).join('');
    return `${scenario}<div class="card"><p class="task">${esc(TEXT.roundDone)}</p>
      <table class="summary"><tr><th></th><th>用时</th><th>切出页面</th></tr>${rows}</table>
      <button type="button" class="btn btn--primary" data-act="next" id="to-survey" disabled>去填问卷</button></div>`;
  }
  const task = TASKS.find((t) => t.id === ph);
  const doneTasks = TASKS.filter((t) => state.times[step.round][t.id] != null)
    .map((t) => `<li>${esc(t.title)} ✓ <span class="done-time">${mmss(state.times[step.round][t.id])}</span></li>`).join('');
  return `${scenario}
    ${doneTasks ? `<ul class="done-list">${doneTasks}</ul>` : ''}
    <div class="card card--task">
      <p class="eyebrow">${esc(task.title)}</p>
      <p class="task">${esc(task.text)}</p>
      <div class="task__foot">
        <span class="timer" id="timer">00:00</span>
        <button type="button" class="btn btn--primary" data-act="task-done">${esc(task.done)}</button>
      </div>
      <p class="timer-note" id="timer-note" hidden>已超过 ${STUDY.longTaskMin} 分钟</p>
    </div>`;
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
  renderModerator();
  tick();
}

// ---------- task timer ----------
const SUMMARY_WAIT_SEC = 15; // the round summary stays up this long, for the moderator's notes

function tick() {
  const el = $('#timer');
  if (el && state.taskStart) {
    const sec = Math.floor((Date.now() - state.taskStart) / 1000);
    el.textContent = mmss(sec);
    $('#timer-note').hidden = sec < STUDY.longTaskMin * 60;
  }
  // Round summary: "去填问卷" unlocks after SUMMARY_WAIT_SEC.
  const toSurvey = $('#to-survey');
  if (toSurvey && state.doneAt) {
    const left = SUMMARY_WAIT_SEC - Math.floor((Date.now() - state.doneAt) / 1000);
    toSurvey.disabled = left > 0;
    toSurvey.textContent = left > 0 ? `去填问卷（${left}）` : '去填问卷';
  }
  // Round 2: "开始任务" only once Tourist Mode is on in the prototype (same origin frame).
  const status = $('#tm-status');
  if (status) {
    let on = false;
    try { on = $('#proto').contentDocument?.documentElement.dataset.tourist === 'on'; } catch { /* not loaded */ }
    status.hidden = !on;
    $('[data-act="start"]').disabled = !on;
  }
}
setInterval(tick, 500);

// ---------- leaving the page during a task (another browser tab, minimised window) ----------
// Counts switches and time away per task. Note: a separate browser window placed beside
// this one is not detected; ask participants to search in a new tab of this window.
let awayStart = null;
document.addEventListener('visibilitychange', () => {
  const step = steps[state.step];
  if (!state.taskStart || !step?.round || !TASKS.some((t) => t.id === state.phase)) return;
  const rec = (state.away[step.round][state.phase] ??= { switches: 0, sec: 0 });
  if (document.hidden) {
    rec.switches += 1;
    awayStart = Date.now();
  } else if (awayStart) {
    rec.sec += Math.round((Date.now() - awayStart) / 1000);
    awayStart = null;
  }
  save();
});

// ---------- actions ----------
function go(stepIndex) {
  state.step = Math.max(0, Math.min(steps.length - 1, stepIndex));
  state.phase = 'intro';
  state.taskStart = null;
  save();
  render();
  window.scrollTo(0, 0);
}

function startTask(id) {
  state.phase = id;
  state.taskStart = Date.now();
  save();
  render();
}

document.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const step = steps[state.step];
  if (act === 'next') return go(state.step + 1);
  if (act === 'start') {
    state.times[step.round] = {}; // a round (re)started: its earlier times no longer apply
    state.away[step.round] = {};
    return startTask('T1');
  }
  if (act === 'task-done') {
    const sec = Math.round((Date.now() - state.taskStart) / 1000);
    state.times[step.round][state.phase] = sec;
    state.taskStart = null;
    const i = TASKS.findIndex((t) => t.id === state.phase);
    if (state.phase === 'T2') { state.phase = 'verify'; save(); return render(); } // moderator's 3 questions
    if (i < TASKS.length - 1) return startTask(TASKS[i + 1].id);
    state.phase = 'done';
    state.doneAt = Date.now();
    save();
    return render();
  }
  if (act === 'after-verify') return startTask('T3');
  if (act === 'mod-go') return go(Number(e.target.closest('[data-step]').dataset.step));
  if (act === 'mod-copy') {
    navigator.clipboard?.writeText(dataParam(2)).then(() => { e.target.textContent = '已复制'; });
    return;
  }
  if (act === 'mod-reset') {
    if (confirm(`清空 ${code} 的进度和用时，从头开始？`)) { state = fresh(); save(); protoLoadedFor = null; render(); }
  }
});

// ---------- moderator panel (collapsed by default) ----------
function renderModerator() {
  const t = (r, k) => (state.times[r][k] != null
    ? `${mmss(state.times[r][k])} · 切出 ${state.away[r]?.[k]?.switches ?? 0}` : '—');
  $('#moderator-body').innerHTML = `
    <p><b>${esc(code)}</b> · 情境顺序 ${order[0]} → ${order[1]}
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

// ---------- start screen (no participant code) ----------
function renderStart() {
  document.body.classList.add('is-start');
  $('#main').innerHTML = `
    <section class="card">
      <h1>情境实验</h1>
      <p>请输入主持人提供的参与者编号，然后开始。</p>
      <form id="start-form" class="start-form">
        <input name="p" placeholder="P01" pattern="[Pp]\\d{2}" required autocomplete="off" aria-label="参与者编号">
        <button class="btn btn--primary">开始</button>
      </form>
    </section>`;
  $('#start-form').addEventListener('submit', (e) => {
    e.preventDefault();
    location.search = `?p=${encodeURIComponent(e.target.p.value.toUpperCase())}`;
  });
}

if (/^P\d{2}$/.test(code)) {
  $('#participant').textContent = code;
  render();
} else renderStart();
