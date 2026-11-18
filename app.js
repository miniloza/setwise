import { GROUPS, DATA_SCHEMA_VERSION, loadData, writeData, validateData, makeId } from './db.js';
import { restStatus, formatCountdown, nextWorkoutTarget, nextSetTarget } from './progression.js';
import { isWorking, isWarmup, isDrop, workingSets, topSet, exerciseAnalytics, exerciseType, exerciseHistory, bodyweightRelative, progressionAdvice, warmupPlan, sameOrdinalAverage, correspondingPrevious, bodyweightForDate, bodyPartSummary } from './analytics.js';

const APP_VERSION = '1.3.0';
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const importInput = document.getElementById('import-file');
let data;
let view = 'home';
let selectedExerciseId = null;
let draft = null;
let historySessionId = null;
let insightsExerciseId = null;
let insightsBodyPart = 'Chest';
let manageGroup = 'Chest';
let includeArchived = false;
let insightChart = 'six';
let modal = null;
let busy = false;
let toastTimer;
let restStartAt = null;
let restSessionId = null;

const glyphs = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  activity:'<path d="m2 12 5-1 3-7 4 16 3-8h5"/>',
  history:'<path d="M3 12a9 9 0 1 0 3-6.7M3 3v6h6"/><path d="M12 7v5l4 2"/>',
  dumbbell:'<path d="m6.5 6.5 11 11m-13-8 5-5m5 15 5-5M2 12l10-10m10 10L12 22"/>',
  trend:'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l-1.9 1.9a1.8 1.8 0 0 0-2-.4l-.8 1.7h-2.7l-.8-1.7a1.8 1.8 0 0 0-2 .4L7.7 17a1.8 1.8 0 0 0 .4-2l-1.7-.8v-2.7l1.7-.8a1.8 1.8 0 0 0-.4-2l1.9-1.9a1.8 1.8 0 0 0 2 .4l.8-1.7h2.7l.8 1.7a1.8 1.8 0 0 0 2-.4l1.9 1.9a1.8 1.8 0 0 0-.4 2l1.7.8v2.7z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  close:'<path d="M5 5l14 14M19 5 5 19"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>',
  upload:'<path d="M12 17V5m-5 5 5-5 5 5M5 17v4h14v-4"/>',
  edit:'<path d="m4 16-.5 4.5L8 20l12-12-4-4L4 16zM14 6l4 4"/>',
  trash:'<path d="M4 7h16M10 3h4m-8 4 1 14h10l1-14M10 11v6m4-6v6"/>',
  spark:'<path d="m12 2 2 7 7 3-7 2-2 8-3-8-7-2 7-3z"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>',
  folder:'<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  play:'<path d="m8 5 11 7-11 7z"/>'
};
const BODY_ACCENTS = {
  Chest:'M37 32c5-5 13-8 23-8s18 3 23 8l-10 9c-3-3-8-5-13-5s-10 2-13 5z',
  Back:'M37 29c6-5 14-8 23-8s17 3 23 8l-7 13c-5-3-11-5-16-5s-11 2-16 5z',
  Shoulders:'M28 29c5-5 10-7 15-7h5l-4 12H32zm44 0c-5-5-10-7-15-7h-5l4 12h12z',
  Arms:'M29 34l9 4-4 17-8-3zm62 0-9 4 4 17 8-3z',
  Legs:'M44 56h12l-3 30H40zm20 0h12l4 30H67z',
  Core:'M48 36h24l-3 28H51z',
  'Full Body':'M37 32c5-5 13-8 23-8s18 3 23 8l-10 9c-3-3-8-5-13-5s-10 2-13 5z M44 56h12l-3 30H40zm20 0h12l4 30H67z M29 34l9 4-4 17-8-3zm62 0-9 4 4 17 8-3z'
};

function icon(name, size=20) { return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyphs[name]||glyphs.activity}</svg>`; }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v])); }
function fmtNum(n, max=1) { return Number(n).toLocaleString('en-ZA',{maximumFractionDigits:max}); }
function dayKey(v) { const d=new Date(v); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function formatDate(v, opts={day:'numeric',month:'short',year:'numeric'}) { return new Date(v).toLocaleDateString('en-ZA',opts); }
function formatTime(v) { return new Date(v).toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'}); }
function activeSession() { return data.sessions.find(s=>!s.endedAt) || null; }
function allCompleted() { return [...data.sessions].filter(s=>s.endedAt && s.sets.length).sort((a,b)=>Date.parse(b.endedAt)-Date.parse(a.endedAt)); }
function getExercise(id) { return data.exercises.find(e=>e.id===id); }
function currentExerciseSets() { const s=activeSession(); return s && selectedExerciseId ? s.sets.filter(t=>t.exerciseId===selectedExerciseId) : []; }
function nextSetNumber(id) { const s=activeSession(); return s ? 1 + Math.max(0,...s.sets.filter(t=>t.exerciseId===id).map(t=>t.setNumber)) : 1; }
function exerciseSessions(id, n=99999) { return allCompleted().filter(s=>s.sets.some(t=>t.exerciseId===id)).slice(0,n); }
function volume(session) { return session.sets.filter(t=>t.kind!=='warmup').reduce((sum,t)=>sum+t.weight*t.reps,0); }
function activeExercises() { return data.exercises.filter(e=>!e.archived).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name)); }
function currentBodyweight() { return data.settings.bodyweightKg ?? null; }
function notify(message, error=false) { toastEl.textContent=message; toastEl.className=`toast show ${error?'error':''}`; clearTimeout(toastTimer); toastTimer=setTimeout(()=>toastEl.className='toast',3900); }
async function commit(change) {
  if (busy) return false;
  busy=true;
  try {
    const newData = structuredClone(data);
    change(newData);
    await writeData(newData);
    data = newData;
    return true;
  } catch(e) { console.error(e); notify(e.message||'Unable to save. Try again.',true); return false; }
  finally { busy=false; }
}
function navItems() { return [['home','Overview','home'],['session','Workout','dumbbell'],['history','Sessions','history'],['insights','Analytics','trend'],['settings','Settings','settings']]; }
function navigation(mobile=false) { return navItems().map(([key,label,glyph])=>`<button class="${mobile?'bottom-link':'nav-link'} ${view===key?'active':''}" data-action="nav" data-view="${key}" ${view===key?'aria-current="page"':''}>${icon(glyph,mobile?22:20)}<span>${label}</span>${key==='session'&&activeSession()?'<span class="nav-dot"></span>':''}</button>`).join(''); }
function bodyPartIcon(group) {
  return `<svg class="muscle-figure" viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="rgba(180,190,200,.55)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="16" r="8"/><path d="M46 30c3-5 8-8 14-8s11 3 14 8l6 13-7 13-6 30H49l-6-30-7-13z"/><path d="M43 33 29 54m48-21 14 21M52 86l-8 22m24-22 8 22"/></g><path d="${BODY_ACCENTS[group]||BODY_ACCENTS['Full Body']}" fill="rgba(129,216,208,.88)" stroke="rgba(129,216,208,.0)"/></svg>`;
}
function syncRestTimer() {
  const session = activeSession();
  if(!session || !session.sets.length) { restStartAt=null; restSessionId=null; return; }
  if(restSessionId!==session.id) { restSessionId=session.id; restStartAt=Date.now(); }
}
function updateRestTimer() {
  const status = restStatus(restStartAt, data?.settings?.restSeconds ?? 120);
  document.querySelectorAll('[data-rest-clock]').forEach(el=>{el.textContent=status?formatCountdown(status.seconds):'—';});
  document.querySelectorAll('.rest-tile').forEach(el=>el.classList.toggle('rest-ready',!!status?.ready));
  document.querySelectorAll('[data-current-time]').forEach(el=>el.textContent=formatTime(new Date()));
}
function prefillDraft() {
  if (!selectedExerciseId) return;
  const setNumber = nextSetNumber(selectedExerciseId);
  const here = currentExerciseSets().filter(t=>t.kind==='working').slice(-1)[0];
  const completed = exerciseHistory(data.sessions, selectedExerciseId);
  const prev = completed.length ? workingSets(completed.at(-1), selectedExerciseId).filter(t=>t.kind==='working').at(-1) : null;
  const value = here || prev;
  draft = { exerciseId:selectedExerciseId, setNumber, kind:'working', weight:value?.weight ?? 0, reps:value?.reps ?? 10, partials:0, dropSets:[1,2,3].map(()=>({weight:0,reps:10})) };
}
function render() {
  if(!data) return;
  syncRestTimer();
  const titles={home:'Overview',session:'Workout',history:'Session history',insights:'Analytics',exercises:'Exercises',settings:'Settings'};
  app.innerHTML=`<div class="shell"><aside class="sidebar"><button class="brand" data-action="nav" data-view="home" aria-label="Setwise home"><span class="brand-mark">S</span><span class="brand-name">setwise<small>LOCAL FIRST TRACKING</small></span></button><div class="nav-label">YOUR SPACE</div><nav aria-label="Main navigation">${navigation()}</nav><div class="side-bottom"><div class="local-pill"><span class="local-dot"></span> Private by design</div><p>Stored on this device.<br/>No account. No cloud.</p><span class="version">VERSION ${APP_VERSION}</span></div></aside><div class="main"><header class="topbar"><div class="top-title">${esc(titles[view])}<span class="top-divider">/</span><span class="top-subtitle">${formatDate(new Date(),{weekday:'short',day:'numeric',month:'short'})}</span></div><div class="top-actions"><span class="offline-chip">${icon('check',15)} LOCAL FIRST</span><div class="avatar">SW</div></div></header><main class="page" id="main-content">${renderContent()}</main></div><nav class="bottom-nav" aria-label="Main navigation">${navigation(true)}</nav></div>${renderModal()}`;
  updateRestTimer();
}
function renderContent() {
  switch(view) {
    case 'home': return renderHome();
    case 'session': return renderSession();
    case 'history': return renderHistory();
    case 'insights': return renderInsights();
    case 'exercises': return renderExercises();
    case 'settings': return renderSettings();
    default: return renderHome();
  }
}
function renderHome() {
  const completed = allCompleted();
  const since = Date.now() - 7*24*60*60*1000;
  const weekly = completed.filter(s => Date.parse(s.endedAt) > since);
  const weeklySets = weekly.reduce((a,s)=>a+s.sets.length,0);
  const weeklyVolume = weekly.reduce((a,s)=>a+volume(s),0);
  const active = activeSession();
  return `<div class="page-enter"><div class="hero hero-lite"><div class="hero-copy"><div class="eyebrow"><span class="eyebrow-line"></span> YOUR FITNESS TRACKER</div><h1>Progress you can <em>feel.</em></h1><p>Log the work. Improve the load. Keep the data private.</p>${active?`<button class="btn btn-accent hero-button" data-action="resume">Resume ${esc(active.bodyPart)} session ${icon('arrow')}</button>`:''}</div><div class="hero-art minimalist-glow">${icon('trend',96)}</div></div><div class="stats-grid"><div class="stat"><span class="stat-label">SESSIONS <span>LAST 7 DAYS</span></span><strong>${weekly.length.toString().padStart(2,'0')}</strong></div><div class="stat"><span class="stat-label">SETS <span>LAST 7 DAYS</span></span><strong>${weeklySets.toString().padStart(2,'0')}</strong></div><div class="stat"><span class="stat-label">VOLUME <span>LAST 7 DAYS</span></span><strong>${fmtNum(weeklyVolume,0)}<small> kg</small></strong></div></div><div class="section-heading"><div><div class="eyebrow">WHAT ARE YOU TRAINING TODAY?</div><h2>Choose a body part</h2></div><span class="section-meta">${GROUPS.length} OPTIONS</span></div><div class="group-grid">${GROUPS.map(group=>{ const count=data.exercises.filter(e=>e.bodyPart===group&&!e.archived).length; const last=completed.find(s=>s.bodyPart===group); return `<button class="group-card group-card-figure" data-action="start" data-group="${esc(group)}"><div class="group-figure-wrap">${bodyPartIcon(group)}</div><h3>${esc(group)}</h3><div class="group-footer"><span>${count} exercises</span><span>${last?formatDate(last.endedAt,{day:'numeric',month:'short'}):'Not yet'}</span></div></button>`; }).join('')}</div></div>`;
}
function sessionExerciseGroups(session) {
  const list = activeExercises().filter(e=>!e.archived || session.sets.some(t=>t.exerciseId===e.id));
  return GROUPS.map(g => [g, list.filter(e=>e.bodyPart===g)]).filter(([,items])=>items.length);
}
function renderSession() {
  const s = activeSession();
  if(!s) return `<div class="page-enter"><div class="section-heading"><div><div class="eyebrow">START A SESSION</div><h1>Choose a body part</h1></div></div><div class="group-grid">${GROUPS.map(group=>`<button class="group-card compact group-card-figure" data-action="start" data-group="${esc(group)}"><div class="group-figure-wrap small">${bodyPartIcon(group)}</div><h3>${esc(group)}</h3></button>`).join('')}</div></div>`;
  if(selectedExerciseId && !getExercise(selectedExerciseId)) selectedExerciseId = null;
  if(!selectedExerciseId) {
    return `<div class="page-enter"><div class="workout-strip"><div><div class="eyebrow">ACTIVE SESSION</div><h2>${esc(s.bodyPart)} day</h2><p class="subheading">${s.sets.length} sets recorded · Started ${formatTime(s.startedAt)}</p></div><div class="workout-strip-actions"><button class="btn btn-outline" data-action="finish-session">End session</button></div></div><div class="section-heading compact-head"><div><div class="eyebrow">CHOOSE AN EXERCISE</div><h2>Session exercises</h2></div><div class="right-stack"><button class="btn btn-outline btn-sm" data-action="nav" data-view="settings">Manage exercises</button><button class="btn btn-accent btn-sm" data-action="new-exercise" data-group="${esc(s.bodyPart)}">${icon('plus',17)} Add exercise</button></div></div><div class="exercise-groups">${sessionExerciseGroups(s).map(([group,items])=>`<section class="exercise-group-box"><div class="exercise-group-head"><strong>${esc(group)}</strong>${group!==s.bodyPart?'<span class="subtle-chip">Accessory</span>':''}</div><div class="exercise-picker">${items.map(e=>{const last=exerciseSessions(e.id,1)[0];const done=s.sets.filter(t=>t.exerciseId===e.id).length;const advice=progressionAdvice(data.sessions,e.id,data.settings.incrementKg);return `<button class="exercise-pick" data-action="open-exercise" data-id="${esc(e.id)}"><div class="exercise-pick-copy"><strong>${esc(e.name)}</strong><span>${last?`Last: ${formatDate(last.endedAt,{day:'numeric',month:'short'})}`:'No previous data'}</span><span class="exercise-pick-goal">${esc(advice.title)}</span></div>${done?`<span class="completed-tag">${done} logged</span>`:`<span class="exercise-target">${e.targetSets} planned</span>`}${icon('chevron',18)}</button>`;}).join('')}</div></section>`).join('')}</div></div>`;
  }
  const e = getExercise(selectedExerciseId);
  const allSets = currentExerciseSets();
  const working = allSets.filter(t=>t.kind==='working');
  const ordinal = working.length + 1;
  const prev = correspondingPrevious(data.sessions, e.id, ordinal);
  const avg = sameOrdinalAverage(data.sessions, e.id, ordinal);
  const plan = progressionAdvice(data.sessions, e.id, data.settings.incrementKg);
  const liveTarget = nextSetTarget(allSets, allCompleted(), e.id, data.settings.incrementKg);
  const six = exerciseAnalytics(data.sessions,e.id).strongest?.six ?? null;
  if(!draft || draft.exerciseId!==e.id || draft.setNumber!==nextSetNumber(e.id)) prefillDraft();
  const type = draft.kind;
  const showHalfReps = type !== 'warmup';
  const savedCount = allSets.length;
  const targetRepText = type==='warmup' ? 'Warm-up' : '6–10';
  const prevValue = prev ? `${fmtNum(prev.weight)} kg × ${prev.reps}${prev.partials?` + ${prev.partials}/5`:''}` : 'Not logged';
  const avgValue = avg ? `${fmtNum(avg.weight)} kg × ${fmtNum(avg.reps)} reps` : 'Not enough data';
  return `<div class="page-enter workout-page"><div class="workout-sticky"><div class="workout-sticky-head"><div><div class="eyebrow">SETWISE / ${esc(s.bodyPart.toUpperCase())} DAY</div><h2>${esc(e.name)} <small>· Set ${draft.setNumber}</small></h2></div><div class="clock-wrap"><span>Current time</span><strong data-current-time>--:--</strong></div></div><form id="log-set-form"><div class="banner-grid"><div class="banner-tile"><label>Weight / kg</label><div class="banner-stepper"><button type="button" data-action="step" data-field="weight" data-delta="-1">−</button><input id="weight-input" type="number" inputmode="decimal" step="any" min="0" value="${draft.weight}"/><button type="button" data-action="step" data-field="weight" data-delta="1">+</button></div></div><div class="banner-tile"><label>Reps</label><div class="banner-stepper"><button type="button" data-action="step" data-field="reps" data-delta="-1">−</button><input id="reps-input" type="number" inputmode="numeric" step="1" min="1" value="${draft.reps}"/><button type="button" data-action="step" data-field="reps" data-delta="1">+</button></div></div><div class="banner-tile rest-tile"><label>Rest</label><div class="banner-readout"><strong data-rest-clock>—</strong></div></div><div class="banner-tile"><label>Target</label><div class="banner-readout"><strong>${targetRepText}</strong></div></div></div>${type==='drop'?`<div class="drop-grid">${draft.dropSets.map((row,i)=>`<div class="drop-row"><span>Drop ${i+1}</span><input type="number" id="drop-weight-${i}" data-drop-index="${i}" data-drop-field="weight" min="0" step="any" value="${row.weight}" placeholder="kg"/><input type="number" id="drop-reps-${i}" data-drop-index="${i}" data-drop-field="reps" min="1" step="1" value="${row.reps}" placeholder="reps"/></div>`).join('')}</div>`:''}<div class="banner-actions"><button class="btn btn-accent" type="submit" value="set">Save & next set ${icon('arrow',17)}</button><button class="btn btn-outline" type="submit" value="exercise">Save & next exercise ${icon('arrow',17)}</button></div><div class="workout-tiny-controls"><span>${working.length} working · ${data.exercises.find(x=>x.id===e.id)?.targetSets ?? 3} planned</span><div><button type="button" data-action="choose-exercise">Next exercise</button><button type="button" data-action="finish-session">End session</button></div></div></form></div><div class="workout-content"><div class="block-title">01 / YOUR BASELINE · WORKING SET ${ordinal}</div><div class="workout-compare"><div class="comp-card"><span>Recent average</span><strong>${esc(avgValue)}</strong><small>Comparable working sets only</small></div><div class="comp-card"><span>Previous workout</span><strong>${esc(prevValue)}</strong><small>Last completed session</small></div></div><div class="effort-panel"><div><strong>SET TYPE</strong><div class="set-type-buttons">${['working','warmup','drop'].map(k=>`<button type="button" class="set-type ${type===k?'active':''}" data-action="set-kind" data-kind="${k}">${k==='working'?'Working set':k==='warmup'?'Warm-up':'Drop set'}</button>`).join('')}</div></div>${showHalfReps?`<div><strong>HALF REPS (0–5)</strong><div class="rir-options">${[0,1,2,3,4,5].map(v=>`<button type="button" class="rir-option ${draft.partials===v?'active':''}" data-action="set-partials" data-partials="${v}">${v}</button>`).join('')}</div></div>`:''}</div><div class="target-duo"><div class="coach-minimal"><span>02 / 6 REP MAX</span><strong>${six?`${fmtNum(six)} kg`:'Need more data'}</strong><p>${six?'Estimated from your strongest comparable working set.':'Complete a few weighted working sets to build this estimate.'}</p></div><div class="coach-minimal"><span>03 / NEXT SET</span><strong>${esc(liveTarget.title)}</strong><p>${esc(liveTarget.description)}</p></div></div><details class="workout-set-history"><summary>${savedCount} sets logged · tap for history and corrections</summary><div class="set-list">${allSets.map(t=>`<div class="set-row"><span>${t.kind==='warmup'?'Warm-up':t.kind==='drop'?'Drop set':'Working set'} ${t.setNumber}${t.partials?` · ${t.partials}/5 half reps`:''}</span><strong>${fmtNum(t.weight)} kg × ${t.reps}</strong><button class="icon-button" data-action="edit-set" data-id="${esc(t.id)}" data-session="${esc(s.id)}">${icon('edit',16)}</button></div>`).join('') || '<div class="empty-mini">No sets logged yet</div>'}</div>${allSets.length?`<button class="subtle-action" data-action="undo-set">Delete last set</button>`:''}</details></div></div>`;
}
function renderHistory() {
  const sessions = allCompleted();
  if(historySessionId) {
    const s = data.sessions.find(x=>x.id===historySessionId);
    if(!s) historySessionId = null;
    else {
      const byExercise = [...new Set(s.sets.map(t=>t.exerciseId))];
      return `<div class="page-enter"><button class="crumb" data-action="history-back">${icon('back',17)} Back to sessions</button><div class="section-heading"><div><div class="eyebrow">SESSION RECORD</div><h1>${esc(s.bodyPart)} · ${formatDate(s.endedAt || s.startedAt)}</h1><p class="subheading">Started ${formatTime(s.startedAt)}${s.endedAt?` · Ended ${formatTime(s.endedAt)}`:''}</p></div><div class="right-stack"><button class="btn btn-outline" data-action="resume-session" data-id="${esc(s.id)}">${icon('play',16)} Resume session</button><button class="btn btn-outline danger-outline" data-action="delete-session" data-id="${esc(s.id)}">${icon('trash',17)} Delete</button></div></div><div class="stats-grid slim"><div class="stat"><span class="stat-label">TOTAL SETS</span><strong>${s.sets.length}</strong></div><div class="stat"><span class="stat-label">EXERCISES</span><strong>${byExercise.length}</strong></div><div class="stat"><span class="stat-label">VOLUME</span><strong>${fmtNum(volume(s),0)}<small> kg</small></strong></div></div>${byExercise.map(id=>{const ex=getExercise(id); return `<section class="history-detail"><div class="history-detail-title"><h3>${esc(ex?.name||'Unknown')}</h3><span>${s.sets.filter(t=>t.exerciseId===id).length} sets</span></div><div class="history-table"><div class="history-row table-head"><span>Set</span><span>Weight</span><span>Reps</span><span>Type</span><span></span></div>${s.sets.filter(t=>t.exerciseId===id).sort((a,b)=>a.setNumber-b.setNumber).map(t=>`<div class="history-row"><span>${t.setNumber}</span><span>${fmtNum(t.weight)} kg</span><span>${t.reps}${t.partials?` + ${t.partials}/5`:''}</span><span>${t.kind}</span><button class="icon-button" data-action="edit-set" data-id="${esc(t.id)}" data-session="${esc(s.id)}">${icon('edit',16)}</button></div>`).join('')}</div></section>`;}).join('')}</div>`;
    }
  }
  return `<div class="page-enter"><div class="section-heading"><div><div class="eyebrow">COMPLETED SESSIONS</div><h1>Session history</h1></div><span class="section-meta">${sessions.length} completed</span></div>${sessions.length?`<div class="history-list">${sessions.map(s=>`<button class="history-card" data-action="history-open" data-id="${esc(s.id)}"><span class="history-date"><strong>${formatDate(s.endedAt,{day:'2-digit'})}</strong><small>${formatDate(s.endedAt,{month:'short',year:'numeric'})}</small></span><div class="history-main"><strong>${esc(s.bodyPart)} day</strong><small>${s.sets.length} sets · ${new Set(s.sets.map(t=>t.exerciseId)).size} exercises · ${formatTime(s.endedAt)}</small></div><span class="history-vol">${fmtNum(volume(s),0)} <small>kg</small></span>${icon('chevron',19)}</button>`).join('')}</div>`:`<div class="empty-state large-empty"><h3>No completed sessions yet.</h3><p>Finish your first session to build history.</p><button class="btn btn-accent" data-action="nav" data-view="session">Start training</button></div>`}</div>`;
}
function sparkChart(points, metric) {
  const measurements = points.map(p=>({label:formatDate(p.session.endedAt,{day:'numeric',month:'short'}), value: metric==='six'?p.six:metric==='weight'?(p.top?.weight??null):p.volume})).filter(p=>p.value!=null);
  if(!measurements.length) return '<div class="empty-chart">Add completed working sets to see this trend.</div>';
  const values=measurements.map(p=>p.value),lo=Math.min(...values),hi=Math.max(...values),spread=Math.max(1,hi-lo),min=Math.max(0,lo-spread*.25),max=hi+spread*.25;
  const x=i=>measurements.length===1?340:50+i*580/(measurements.length-1);
  const y=v=>195-(v-min)/(max-min)*160;
  const pth=measurements.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const dots=measurements.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="5" fill="#81D8D0" stroke="#000" stroke-width="2"></circle>`).join('');
  const lines=[0,.25,.5,.75,1].map(i=>{const v=min+(max-min)*i,yp=y(v);return `<line x1="50" x2="630" y1="${yp}" y2="${yp}" stroke="#292929" stroke-dasharray="4 5"/><text x="42" y="${yp+4}" text-anchor="end" font-size="12" fill="#aaaaaa">${fmtNum(v,0)}</text>`;}).join('');
  return `<svg class="analytics-graph" viewBox="0 0 680 250" role="img" aria-label="Analytics chart"><defs><linearGradient id="area-analytics" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#81D8D0" stop-opacity=".20"/><stop offset="1" stop-color="#81D8D0" stop-opacity="0"/></linearGradient></defs>${lines}<path d="${pth} L${x(measurements.length-1)} 195 L${x(0)} 195 Z" fill="url(#area-analytics)"/><path d="${pth}" fill="none" stroke="#81D8D0" stroke-width="3"/>${dots}<text x="50" y="231" fill="#aaaaaa" font-size="12">${esc(measurements[0].label)}</text><text x="630" y="231" text-anchor="end" fill="#aaaaaa" font-size="12">${esc(measurements.at(-1).label)}</text></svg>`;
}
function renderInsights() {
  const activeExercisesInGroup = data.exercises.filter(e=>e.bodyPart===insightsBodyPart && exerciseHistory(data.sessions,e.id).length).sort((a,b)=>a.name.localeCompare(b.name));
  if(!activeExercisesInGroup.some(e=>e.id===insightsExerciseId)) insightsExerciseId = activeExercisesInGroup[0]?.id ?? null;
  const groupSummary = bodyPartSummary(data.sessions, data.exercises, insightsBodyPart);
  const ex = insightsExerciseId ? getExercise(insightsExerciseId) : null;
  const summary = ex ? exerciseAnalytics(data.sessions, ex.id) : null;
  const points = summary?.points ?? [];
  const best = summary?.strongest ?? null;
  const latest = summary?.latest ?? null;
  const advice = ex ? progressionAdvice(data.sessions, ex.id, data.settings.incrementKg) : null;
  const chartOptions = [['six','6RM'],['weight','Top set'],['volume','Volume']];
  const strongDate = best?.session?.endedAt ?? latest?.session?.endedAt ?? null;
  const bwAt = strongDate ? bodyweightForDate(data.settings.bodyweightHistory, strongDate, data.settings.bodyweightKg) : data.settings.bodyweightKg;
  const ratio = bodyweightRelative(best?.one, bwAt);
  return `<div class="page-enter analytics-page"><div class="section-heading"><div><div class="eyebrow">SETWISE / ANALYTICS</div><h1>Strength analytics</h1></div></div><section class="analytics-controls"><div><label for="insights-group">BODY PART</label><select id="insights-group">${GROUPS.map(g=>`<option value="${esc(g)}" ${g===insightsBodyPart?'selected':''}>${esc(g)}</option>`).join('')}</select></div><div><label for="insight-select">EXERCISE DETAIL</label><select id="insight-select" ${!activeExercisesInGroup.length?'disabled':''}>${activeExercisesInGroup.map(e=>`<option value="${esc(e.id)}" ${e.id===insightsExerciseId?'selected':''}>${esc(e.name)}</option>`).join('')||'<option>No completed exercises yet</option>'}</select></div></section><section class="analytics-kpis"><div class="analytics-kpi"><span>TRACKED EXERCISES</span><strong>${groupSummary.trackedExercises}</strong><small>${esc(insightsBodyPart)} exercises with completed data</small></div><div class="analytics-kpi"><span>GROUP VOLUME</span><strong>${fmtNum(groupSummary.totalVolume,0)} <small>kg-reps</small></strong><small>Latest completed work across this body part</small></div><div class="analytics-kpi"><span>GROUP BEST 6RM</span><strong>${groupSummary.strongest?.analytics?.strongest?.six?fmtNum(groupSummary.strongest.analytics.strongest.six)+' <small>kg</small>':'—'}</strong><small>${groupSummary.strongest?esc(groupSummary.strongest.exercise.name):'Need more data'}</small></div><div class="analytics-kpi"><span>BODYWEIGHT</span><strong>${currentBodyweight()!=null?fmtNum(currentBodyweight())+' <small>kg</small>':'—'}</strong><small>Current setting</small></div></section><section class="analytics-card"><h2>${esc(insightsBodyPart)} workout overview</h2><div class="group-summary-grid">${groupSummary.summaries.length?groupSummary.summaries.map(item=>`<button class="summary-exercise-card ${insightsExerciseId===item.exercise.id?'active':''}" data-action="select-insight-exercise" data-id="${esc(item.exercise.id)}"><strong>${esc(item.exercise.name)}</strong><span>Best 6RM · ${item.analytics.strongest?.six?fmtNum(item.analytics.strongest.six)+' kg':'—'}</span><span>Latest volume · ${item.analytics.latest?.volume?fmtNum(item.analytics.latest.volume,0)+' kg-reps':'—'}</span></button>`).join(''):'<div class="empty-state">Complete some sets for this body part to unlock analytics.</div>'}</div></section>${!ex?'':`<section class="analytics-card"><div class="analytics-card-head"><div><h2>${esc(ex.name)}</h2><p>${esc(insightsBodyPart)} · ${esc(exerciseType(ex))}</p></div><span class="analytics-caption">Detail view</span></div><div class="analytics-kpis"><div class="analytics-kpi"><span>EST. 6 REP MAX</span><strong>${best?fmtNum(best.six)+' <small>kg</small>':'—'}</strong></div><div class="analytics-kpi"><span>EST. 1 REP MAX</span><strong>${best?fmtNum(best.one)+' <small>kg</small>':'—'}</strong></div><div class="analytics-kpi"><span>RELATIVE TO BODYWEIGHT</span><strong>${ratio!=null?fmtNum(ratio,2)+'×':'—'}</strong><small>${bwAt!=null?`Using ${fmtNum(bwAt)} kg bodyweight at the time`:'Add bodyweight in Settings'}</small></div><div class="analytics-kpi"><span>NEXT WORKOUT</span><strong>${esc(advice?.weight!=null?fmtNum(advice.weight)+' kg':advice?.title||'—')}</strong><small>${esc(advice?.details||'')}</small></div></div><div class="analytics-chart-tabs">${chartOptions.map(([key,label])=>`<button data-action="insight-chart" data-metric="${key}" class="${insightChart===key?'active':''}">${label}</button>`).join('')}</div>${sparkChart(points.slice(-12), insightChart)}<div class="analytics-duo"><section class="analytics-card inline-card"><span class="eyebrow">AVERAGE WORKING SET</span><strong class="big-analytics small-head">${(() => { const a=sameOrdinalAverage(data.sessions, ex.id, 1); return a?`${fmtNum(a.weight)} kg × ${fmtNum(a.reps)} reps`:'—'; })()}</strong><p>Typical first working set over recent comparable sessions.</p></section><section class="analytics-card inline-card"><span class="eyebrow">NEXT SET FOCUS</span><strong class="big-analytics small-head">${esc(nextWorkoutTarget(allCompleted(), ex.id, data.settings.incrementKg).title)}</strong><p>${esc(nextWorkoutTarget(allCompleted(), ex.id, data.settings.incrementKg).description)}</p></section></div></section>`}</div>`;
}
function renderExercises() {
  const list=data.exercises.filter(e=>e.bodyPart===manageGroup&&(includeArchived||!e.archived)).sort((a,b)=>a.archived-b.archived||a.order-b.order||a.name.localeCompare(b.name));
  return `<div class="page-enter"><div class="section-heading"><div><div class="eyebrow">YOUR EXERCISE LIBRARY</div><h1>Exercises</h1></div><button class="btn btn-accent" data-action="new-exercise" data-group="${esc(manageGroup)}">${icon('plus',18)} Add exercise</button></div><div class="group-tabs" role="group">${GROUPS.map(g=>`<button class="group-tab ${g===manageGroup?'selected':''}" data-action="manage-group" data-group="${esc(g)}">${esc(g)}</button>`).join('')}</div><label class="check-option"><input type="checkbox" id="show-archived" ${includeArchived?'checked':''}/> Show archived</label><div class="library-list">${list.map((e,i)=>`<div class="library-row ${e.archived?'archived':''}"><span class="library-index">${String(i+1).padStart(2,'0')}</span><div class="library-name"><strong>${esc(e.name)}</strong><small>${e.targetSets} target sets ${e.archived?'· Archived':''}</small></div><button class="icon-button" data-action="edit-exercise" data-id="${esc(e.id)}">${icon('edit',18)}</button><button class="icon-button" data-action="${e.archived?'restore-exercise':'archive-exercise'}" data-id="${esc(e.id)}">${icon(e.archived?'refresh':'trash',18)}</button></div>`).join('')||'<div class="empty-state">No exercises in this group.</div>'}</div></div>`;
}
function renderSettings() {
  const count=data.sessions.length, sets=data.sessions.reduce((n,s)=>n+s.sets.length,0);
  const history = [...(data.settings.bodyweightHistory||[])].sort((a,b)=>Date.parse(b.recordedAt)-Date.parse(a.recordedAt)).slice(0,8);
  return `<div class="page-enter"><div class="section-heading"><div><div class="eyebrow">SETTINGS</div><h1>Your app & data</h1></div></div><div class="settings-grid"><section class="settings-card"><div class="settings-icon">${icon('settings',23)}</div><h3>Workout preferences</h3><form id="preferences-form" class="preferences-form"><label for="increment-kg">WEIGHT STEP (KG)</label><input type="number" id="increment-kg" min="0.1" max="100" step="any" value="${data.settings.incrementKg}" required/><label for="rest-seconds">REST TIMER (SECONDS)</label><input type="number" id="rest-seconds" min="15" max="900" step="1" value="${data.settings.restSeconds ?? 120}" required/><button class="btn btn-accent" type="submit">Save settings</button></form></section><section class="settings-card"><div class="settings-icon">${icon('activity',23)}</div><h3>Current bodyweight</h3><form id="bodyweight-form" class="preferences-form"><label for="bodyweight-kg">BODYWEIGHT / KG</label><input id="bodyweight-kg" type="number" inputmode="decimal" step="0.1" min="20" max="400" placeholder="e.g. 80" value="${data.settings.bodyweightKg??''}" required/><button type="submit" class="btn btn-accent">Save bodyweight</button></form><div class="settings-note">Saved with the entry date. Analytics uses the recorded bodyweight relevant to that lift date where possible.</div>${history.length?`<div class="bodyweight-history">${history.map(r=>`<div><span>${fmtNum(r.kg)} kg</span><small>${formatDate(r.recordedAt)}</small></div>`).join('')}</div>`:''}</section><section class="settings-card"><div class="settings-icon">${icon('folder',23)}</div><h3>Local storage</h3><div class="storage-metrics"><span>${count} sessions</span><span>${sets} sets</span></div><div class="storage-metrics"><span>IndexedDB</span><span>No account</span></div><button class="btn btn-outline wide" data-action="nav" data-view="exercises">Manage exercises</button></section><section class="settings-card"><div class="settings-icon">${icon('download',23)}</div><h3>Recovery backup</h3><button class="btn btn-accent wide" data-action="export-json">${icon('download',17)} Export full backup</button><span class="settings-note">${data.settings.lastBackupAt?`Last export initiated: ${formatDate(data.settings.lastBackupAt)}`:'No backup exported yet.'}</span></section><section class="settings-card"><div class="settings-icon">${icon('activity',23)}</div><h3>Apple Numbers export</h3><button class="btn btn-outline wide" data-action="export-csv">${icon('download',17)} Export Numbers CSV</button><span class="settings-note">Open the exported CSV in Apple Numbers from Files.</span></section><section class="settings-card restore-card"><div class="settings-icon">${icon('upload',23)}</div><h3>Restore from backup</h3><button class="btn btn-outline wide" data-action="import-json">${icon('upload',17)} Choose backup file</button><span class="settings-note warning">Restoring replaces the data currently in this installation.</span></section><section class="settings-card"><div class="settings-icon">${icon('info',23)}</div><h3>About Setwise</h3><p>Version ${APP_VERSION} · Data schema ${DATA_SCHEMA_VERSION}</p><p class="settings-note">App updates preserve your local workout database when installed at the same website address.</p></section></div></div>`;
}
function renderModal() {
  if(!modal) return '';
  if(modal.type==='exercise') {
    const e=modal.id?getExercise(modal.id):null;
    return `<div class="modal-backdrop"><div class="dialog" role="dialog" aria-modal="true"><div class="dialog-title"><div><div class="eyebrow">EXERCISE DETAILS</div><h2>${e?'Edit exercise':'New exercise'}</h2></div><button class="icon-button" data-action="close-modal">${icon('close',21)}</button></div><form id="exercise-form"><label for="exercise-name">EXERCISE NAME</label><input id="exercise-name" name="name" maxlength="160" required value="${e?esc(e.name):''}"/><label for="exercise-group">BODY PART</label><select id="exercise-group" name="bodyPart">${GROUPS.map(g=>`<option value="${esc(g)}" ${g===(e?.bodyPart||modal.group)?'selected':''}>${esc(g)}</option>`).join('')}</select><label for="exercise-equipment">EQUIPMENT TYPE</label><select id="exercise-equipment" name="equipment">${[['auto','Automatic'],['machine','Machine'],['barbell','Barbell'],['dumbbell','Dumbbell'],['bodyweight','Bodyweight'],['other','Other']].map(([value,label])=>`<option value="${value}" ${(e?.equipment||'auto')===value?'selected':''}>${label}</option>`).join('')}</select><label for="exercise-target">DEFAULT TARGET SETS</label><input type="number" id="exercise-target" name="targetSets" min="1" max="20" step="1" value="${e?.targetSets||3}" required/><button type="submit" class="btn btn-accent wide">${e?'Save changes':'Add exercise'} ${icon('check',17)}</button></form></div></div>`;
  }
  if(modal.type==='edit-set') {
    const s=data.sessions.find(s=>s.id===modal.sessionId),t=s?.sets.find(x=>x.id===modal.id),e=t?getExercise(t.exerciseId):null;
    if(!t) return '';
    return `<div class="modal-backdrop"><div class="dialog" role="dialog" aria-modal="true"><div class="dialog-title"><div><div class="eyebrow">CORRECT A RECORD</div><h2>${esc(e?.name||'Exercise')} · Set ${t.setNumber}</h2></div><button class="icon-button" data-action="close-modal">${icon('close',21)}</button></div><form id="edit-set-form"><label for="edit-weight">WEIGHT (KG)</label><input type="number" id="edit-weight" name="weight" min="0" max="10000" step="any" required value="${t.weight}"/><label for="edit-reps">REPETITIONS</label><input type="number" id="edit-reps" name="reps" min="1" max="10000" step="1" required value="${t.reps}"/><label for="edit-kind">SET TYPE</label><select id="edit-kind" name="kind"><option value="working" ${t.kind==='working'?'selected':''}>Working set</option><option value="warmup" ${t.kind==='warmup'?'selected':''}>Warm-up</option><option value="drop" ${t.kind==='drop'?'selected':''}>Drop set</option></select><label for="edit-partials">HALF REPS (0-5)</label><select id="edit-partials" name="partials"><option value="0">0</option>${[1,2,3,4,5].map(v=>`<option value="${v}" ${t.partials===v?'selected':''}>${v}</option>`).join('')}</select><button type="submit" class="btn btn-accent wide">Save correction ${icon('check',17)}</button></form></div></div>`;
  }
  return '';
}
async function setView(v) { if(![...navItems().map(x=>x[0]),'exercises'].includes(v)) return; view=v; if(v==='session'&&!activeSession()) selectedExerciseId=null; historySessionId=null; render(); window.scrollTo({top:0,behavior:'instant'}); }
async function saveSet(next) {
  const s=activeSession(); if(!s || !selectedExerciseId) return;
  const id = selectedExerciseId;
  const kind = draft?.kind || 'working';
  if(kind === 'drop') {
    const rows = [0,1,2].map(i => ({ weight:Number(document.getElementById(`drop-weight-${i}`)?.value), reps:Number(document.getElementById(`drop-reps-${i}`)?.value) }));
    if(rows.some(r=>!Number.isFinite(r.weight)||r.weight<0||r.weight>10000||!Number.isInteger(r.reps)||r.reps<1||r.reps>10000)) { notify('Enter valid drop-set weights and reps.',true); return; }
    const dropGroupId = makeId();
    const ok = await commit(d => {
      const session = d.sessions.find(t=>t.id===s.id);
      let setNumber = nextSetNumber(id);
      rows.forEach((r,index)=>session.sets.push({id:makeId(),exerciseId:id,setNumber:setNumber++,weight:r.weight,reps:r.reps,kind:'drop',partials:0,dropGroupId,dropIndex:index+1,createdAt:new Date().toISOString()}));
    });
    if(ok) { if(next==='exercise') { selectedExerciseId=null; draft=null; } else { prefillDraft(); } restStartAt=Date.now(); restSessionId=s.id; render(); notify('Drop set saved.'); }
    return;
  }
  const weight = Number(document.getElementById('weight-input')?.value);
  const reps = Number(document.getElementById('reps-input')?.value);
  if(!Number.isFinite(weight)||weight<0||weight>10000||!Number.isInteger(reps)||reps<1||reps>10000) { notify('Enter a valid weight and a whole number of reps.',true); return; }
  const partials = kind === 'warmup' ? 0 : Number.isInteger(draft?.partials) ? draft.partials : 0;
  const setNumber = nextSetNumber(id);
  const ok = await commit(d => { const session = d.sessions.find(t=>t.id===s.id); session.sets.push({id:makeId(),exerciseId:id,setNumber,weight,reps,kind,partials,dropGroupId:null,dropIndex:null,createdAt:new Date().toISOString()}); });
  if(ok) { if(next==='exercise'){selectedExerciseId=null;draft=null;notify('Set saved. Choose the next exercise.');} else { draft={...draft, weight, reps, partials:0, setNumber:setNumber+1, kind:'working'}; notify(`Set ${setNumber} saved.`);} restStartAt=Date.now(); restSessionId=s.id; render(); }
}
async function exportFile(filename,mimetype,content) {
  const file=new File([content],filename,{type:mimetype});
  if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) {
    try { await navigator.share({files:[file],title:'Setwise export'}); return true; } catch(e) { if(e.name==='AbortError') return false; }
  }
  try { const url=URL.createObjectURL(file), link=document.createElement('a'); link.href=url; link.download=filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000); return true; } catch { notify('Export failed. Please try again.',true); return false; }
}
async function backup() { const snapshot=structuredClone(data); const text=JSON.stringify({app:'Setwise',formatVersion:1,exportedAt:new Date().toISOString(),data:snapshot},null,2); const ok=await exportFile(`setwise-backup-${dayKey(new Date())}.json`,'application/json',text); if(ok){await commit(d=>{d.settings.lastBackupAt=new Date().toISOString();});render();notify('Backup prepared.');} }
function quoteCSV(value){const raw=String(value??'');const t=/^[\s]*[=+@-]/.test(raw)?`'${raw}`:raw;return `"${t.replace(/"/g,'""')}"`;}
function dataCSV() {
  const rows=[['Date','Time','Session Body Part','Exercise','Set Number','Weight (kg)','Repetitions','Half Reps (0-5)','Volume (kg)','Session ID','Set ID','Status','Set Type']];
  for(const s of [...data.sessions].sort((a,b)=>Date.parse(a.startedAt)-Date.parse(b.startedAt))) for(const t of s.sets) {
    const ex=getExercise(t.exerciseId);
    rows.push([dayKey(t.createdAt),formatTime(t.createdAt),s.bodyPart,ex?.name||'Unknown',t.setNumber,t.weight,t.reps,t.partials??0,t.weight*t.reps,s.id,t.id,s.endedAt?'Completed':'In progress',t.kind??'working']);
  }
  return '\ufeff'+rows.map(row=>row.map(quoteCSV).join(',')).join('\r\n')+'\r\n';
}
async function csvExport(){const ok=await exportFile(`setwise-numbers-${dayKey(new Date())}.csv`,'text/csv;charset=utf-8',dataCSV()); if(ok) notify('CSV prepared.');}

app.addEventListener('click', async event => {
  const el = event.target.closest('[data-action]'); if(!el||!app.contains(el)) return;
  const action = el.dataset.action, id = el.dataset.id, group = el.dataset.group;
  switch(action) {
    case 'nav': await setView(el.dataset.view); break;
    case 'start': {
      const active=activeSession();
      if(active && active.bodyPart!==group){ notify(`Finish or resume your current ${active.bodyPart} session first.`, true); view='session'; selectedExerciseId=null; render(); break; }
      if(!active) { const ok = await commit(d=>d.sessions.push({id:makeId(),bodyPart:group,startedAt:new Date().toISOString(),endedAt:null,sets:[]})); if(!ok) break; }
      selectedExerciseId=null; draft=null; view='session'; render(); break;
    }
    case 'resume': view='session'; selectedExerciseId=null; draft=null; render(); break;
    case 'resume-session': {
      const active=activeSession(); if(active && active.id!==id){ notify('Finish or discard the current active session first.',true); break; }
      const ok=await commit(d=>{ const s=d.sessions.find(x=>x.id===id); if(s) s.endedAt=null; });
      if(ok){ view='session'; historySessionId=null; selectedExerciseId=null; draft=null; render(); notify('Session reopened.'); }
      break;
    }
    case 'choose-exercise': selectedExerciseId=null; draft=null; render(); break;
    case 'open-exercise': selectedExerciseId=id; draft=null; prefillDraft(); render(); break;
    case 'set-kind': if(draft){ draft.kind = el.dataset.kind; if(draft.kind==='warmup') draft.partials = 0; render(); } break;
    case 'set-partials': if(draft){ draft.partials = Number(el.dataset.partials); render(); } break;
    case 'select-insight-exercise': insightsExerciseId=id; render(); break;
    case 'insight-chart': insightChart=['six','weight','volume'].includes(el.dataset.metric)?el.dataset.metric:'six'; render(); break;
    case 'step': {
      const field=el.dataset.field; const input=document.getElementById(field==='weight'?'weight-input':'reps-input'); if(!input) return;
      const step=field==='weight'?data.settings.incrementKg:1; const min=field==='weight'?0:1;
      const next=Math.max(min, Math.round((Number(input.value||0)+step*Number(el.dataset.delta))*1000)/1000);
      input.value=next; if(draft) draft[field]=next; break;
    }
    case 'finish-session': {
      const s=activeSession(); if(!s) return;
      if(!s.sets.length) { if(!confirm('No sets have been recorded. Discard this empty session?')) break; const ok=await commit(d=>{d.sessions=d.sessions.filter(x=>x.id!==s.id);}); if(ok){selectedExerciseId=null;view='home';render();notify('Empty session discarded.');} break; }
      if(!confirm(`End ${s.bodyPart} session with ${s.sets.length} recorded sets?`)) break;
      const ok=await commit(d=>{ d.sessions.find(t=>t.id===s.id).endedAt=new Date().toISOString(); });
      if(ok){ selectedExerciseId=null; draft=null; restStartAt=null; restSessionId=null; historySessionId=s.id; view='history'; render(); notify('Session ended and saved.'); }
      break;
    }
    case 'undo-set': {
      const s=activeSession(), sets=currentExerciseSets(); if(!sets.length) return;
      const last=sets[sets.length-1]; if(!confirm(`Delete set ${last.setNumber} (${last.weight} kg × ${last.reps})?`)) break;
      const ok=await commit(d=>{ const ss=d.sessions.find(t=>t.id===s.id); ss.sets=ss.sets.filter(t=>t.id!==last.id); });
      if(ok){ draft=null; render(); notify('Last set deleted.'); }
      break;
    }
    case 'history-open': historySessionId=id; render(); break;
    case 'history-back': historySessionId=null; render(); break;
    case 'delete-session': {
      const s=data.sessions.find(s=>s.id===id); if(!s || !confirm(`Permanently delete this ${s.bodyPart} session?`)) break;
      const ok=await commit(d=>{d.sessions=d.sessions.filter(t=>t.id!==id);}); if(ok){historySessionId=null;render();notify('Session deleted.');}
      break;
    }
    case 'manage-group': manageGroup=group; render(); break;
    case 'new-exercise': modal={type:'exercise',group:group||manageGroup}; render(); document.getElementById('exercise-name')?.focus(); break;
    case 'edit-exercise': modal={type:'exercise',id}; render(); document.getElementById('exercise-name')?.focus(); break;
    case 'archive-exercise': if(await commit(d=>{d.exercises.find(t=>t.id===id).archived=true;})){ render(); notify('Exercise archived.'); } break;
    case 'restore-exercise': if(await commit(d=>{d.exercises.find(t=>t.id===id).archived=false;})){ render(); notify('Exercise restored.'); } break;
    case 'edit-set': modal={type:'edit-set',id,sessionId:el.dataset.session}; render(); document.getElementById('edit-weight')?.focus(); break;
    case 'close-modal': modal=null; render(); break;
    case 'export-json': await backup(); break;
    case 'export-csv': await csvExport(); break;
    case 'import-json': importInput.value=''; importInput.click(); break;
  }
});

app.addEventListener('submit', async event => {
  const form=event.target;
  if(!['log-set-form','exercise-form','edit-set-form','preferences-form','bodyweight-form'].includes(form.id)) return;
  event.preventDefault();
  if(form.id==='log-set-form') { const btn=event.submitter; await saveSet(btn?.value==='exercise'?'exercise':'set'); return; }
  if(form.id==='bodyweight-form') {
    const bw=Number(document.getElementById('bodyweight-kg')?.value);
    if(!Number.isFinite(bw)||bw<20||bw>400){ notify('Enter a bodyweight between 20 and 400 kg.',true); return; }
    if(await commit(d=>{ d.settings.bodyweightKg=bw; d.settings.bodyweightHistory = d.settings.bodyweightHistory || []; d.settings.bodyweightHistory.push({id:makeId(),kg:bw,recordedAt:new Date().toISOString()}); })){ render(); notify('Bodyweight saved locally.'); }
    return;
  }
  const values=new FormData(form);
  if(form.id==='exercise-form') {
    const name=String(values.get('name')||'').trim(), bodyPart=String(values.get('bodyPart')||''), targetSets=Number(values.get('targetSets')), equipment=String(values.get('equipment')||'auto');
    if(!name||name.length>160||!GROUPS.includes(bodyPart)||!Number.isInteger(targetSets)||targetSets<1||targetSets>20){ notify('Please check the exercise details.',true); return; }
    const edId=modal?.id;
    const ok=await commit(d=>{ if(edId){ const ex=d.exercises.find(e=>e.id===edId); Object.assign(ex,{name,bodyPart,targetSets,equipment}); } else d.exercises.push({id:makeId(),name,bodyPart,targetSets,equipment,archived:false,order:Math.max(0,...d.exercises.map(e=>e.order||0))+1}); });
    if(ok){ manageGroup=bodyPart; modal=null; render(); notify(edId?'Exercise updated.':'Exercise added.'); }
    return;
  }
  if(form.id==='edit-set-form') {
    const weight=Number(values.get('weight')), reps=Number(values.get('reps')), kind=String(values.get('kind')||'working'), partials=Number(values.get('partials')||0);
    if(!Number.isFinite(weight)||weight<0||weight>10000||!Number.isInteger(reps)||reps<1||reps>10000||!['working','warmup','drop'].includes(kind)||!Number.isInteger(partials)||partials<0||partials>5){ notify('Please enter valid set details.',true); return; }
    const {id,sessionId}=modal;
    if(await commit(d=>{ const t=d.sessions.find(s=>s.id===sessionId).sets.find(t=>t.id===id); t.weight=weight; t.reps=reps; t.kind=kind; t.partials=kind==='warmup'?0:partials; })){ modal=null; draft=null; render(); notify('Set corrected.'); }
    return;
  }
  if(form.id==='preferences-form') {
    const step=Number(document.getElementById('increment-kg').value); const restSeconds=Number(document.getElementById('rest-seconds').value);
    if(!Number.isFinite(step)||step<=0||step>100||!Number.isFinite(restSeconds)||restSeconds<15||restSeconds>900){ notify('Check the settings values.',true); return; }
    if(await commit(d=>{d.settings.incrementKg=step; d.settings.restSeconds=Math.round(restSeconds);})){ render(); notify('Preferences saved.'); }
  }
});

app.addEventListener('change', event => {
  if(event.target.id==='insight-select'){ insightsExerciseId=event.target.value; render(); }
  else if(event.target.id==='insights-group'){ insightsBodyPart=event.target.value; insightsExerciseId=null; render(); }
  else if(event.target.id==='show-archived'){ includeArchived=event.target.checked; render(); }
});
app.addEventListener('input', event => {
  if(draft && (event.target.id==='weight-input'||event.target.id==='reps-input')) draft[event.target.id==='weight-input'?'weight':'reps']=Number(event.target.value||0);
  if(draft && event.target.dataset.dropField){ draft.dropSets[Number(event.target.dataset.dropIndex)][event.target.dataset.dropField]=Number(event.target.value||0); }
});
importInput.addEventListener('change', async () => {
  const file=importInput.files?.[0]; if(!file) return;
  try {
    if(file.size>50*1024*1024) throw new Error('Backup file is too large.');
    const payload=JSON.parse(await file.text());
    if(payload.app!=='Setwise'||payload.formatVersion!==1||!payload.data) throw new Error('This is not a supported Setwise recovery backup.');
    const replacement=validateData(payload.data);
    const summary=`Restore ${replacement.sessions.length} sessions and ${replacement.exercises.length} exercises?\n\nThis replaces everything currently stored in this app.`;
    if(!confirm(summary)) return;
    if(await commit(d=>{ Object.keys(d).forEach(k=>delete d[k]); Object.assign(d,replacement); })){ selectedExerciseId=null; draft=null; historySessionId=null; insightsExerciseId=null; restStartAt=null; restSessionId=null; view='home'; modal=null; render(); notify('Recovery backup restored successfully.'); }
  } catch(e) { console.error(e); notify(e.message||'Unable to read backup.',true); }
  finally { importInput.value=''; }
});

(async function start() {
  try {
    data=await loadData(); render();
    const tick=()=>updateRestTimer(); tick(); setInterval(tick,1000);
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden) updateRestTimer(); });
    if('serviceWorker' in navigator && location.protocol!=='file:') navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline service worker not registered',e));
  } catch(e) {
    console.error(e); app.innerHTML=`<div class="fatal"><h1>Unable to load your workout records</h1><p>${esc(e.message)}</p><button class="btn btn-accent" onclick="location.reload()">Retry</button></div>`;
  }
})();
