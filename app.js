import { GROUPS, DATA_SCHEMA_VERSION, defaultData, loadData, writeData, validateData, makeId } from './db.js';
import { TARGET_REPS, averageExerciseVolume, sixRepEstimate, restStatus, formatCountdown, nextWorkoutTarget, nextSetTarget } from './progression.js';

const APP_VERSION = '1.1.0';
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const importInput = document.getElementById('import-file');
let data;
let view = 'home';
let selectedExerciseId = null;
let draft = null;
let historySessionId = null;
let insightsExerciseId = null;
let manageGroup = 'Chest';
let includeArchived = false;
let modal = null;
let busy = false;
let toastTimer;
// Rest timing is intentionally ephemeral: not in IndexedDB, exports, or workout records.
let restStartAt = null;
let restSessionId = null;
function syncRestTimer() {
  const session=activeSession();
  if(!session || !session.sets.length) { restStartAt=null; restSessionId=null; return; }
  if(restSessionId!==session.id) { restSessionId=session.id; restStartAt=Date.now(); }
}
function restTimerMarkup() {
  const session=activeSession();
  if(!session?.sets.length)return '';
  return `<div class="rest-timer" role="timer" aria-label="Repeating 2 minute rest countdown"><span class="rest-title">${icon('clock',17)} REST / NEXT SET</span><strong data-rest-clock>2:00</strong><small data-rest-caption>Repeats every 2 minutes</small></div>`;
}
function updateRestTimer() {
  const status=restStatus(restStartAt);
  document.querySelectorAll('[data-rest-clock]').forEach(el=>{el.textContent=status?formatCountdown(status.seconds):'2:00';});
  document.querySelectorAll('[data-rest-caption]').forEach(el=>{el.textContent=status?.ready?'Time for your next set · cycle restarts automatically':'Repeats every 2 minutes';});
  document.querySelectorAll('.rest-timer').forEach(el=>el.classList.toggle('rest-ready',!!status?.ready));
}


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
  pause:'<path d="M9 5H6v14h3zm9 0h-3v14h3z"/>',
  spark:'<path d="m12 2 2 7 7 3-7 2-2 8-3-8-7-2 7-3z"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>',
  folder:'<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
function icon(name, size=20) { return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyphs[name]||glyphs.activity}</svg>`; }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v])); }
function fmtNum(n, max=1) { return Number(n).toLocaleString('en-ZA',{maximumFractionDigits:max}); }
function dayKey(v) { const d=new Date(v); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function formatDate(v, opts={day:'numeric',month:'short',year:'numeric'}) { return new Date(v).toLocaleDateString('en-ZA',opts); }
function formatTime(v) { return new Date(v).toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'}); }
function groupCode(group) { return ({Chest:'CH', Back:'BA',Shoulders:'SH',Arms:'AR',Legs:'LE',Core:'CO','Full Body':'FB'})[group]||'--'; }
function groupDescription(group) { return ({Chest:'Push, press and build',Back:'Pull with purpose',Shoulders:'Strength and stability',Arms:'Details make the difference',Legs:'Build your foundation',Core:'Control and endurance','Full Body':'Everything in motion'})[group]; }
function activeSession() { return data.sessions.find(s=>!s.endedAt) || null; }
function sessionSets(s) { return s?.sets || []; }
function allCompleted() { return [...data.sessions].filter(s=>s.endedAt && s.sets.length).sort((a,b)=>Date.parse(b.endedAt)-Date.parse(a.endedAt)); }
function getExercise(id) { return data.exercises.find(e=>e.id===id); }
function exerciseSessions(id, n=99999) { return allCompleted().filter(s=>s.sets.some(t=>t.exerciseId===id)).slice(0,n); }
function previousSet(id,setNumber) { const s=exerciseSessions(id,1)[0]; if (!s) return null; const matching=s.sets.find(t=>t.exerciseId===id && t.setNumber===setNumber); return {session:s,set:matching||null}; }
function averageForSet(id,setNumber,limit=5) {
  const values=exerciseSessions(id,limit).map(s=>s.sets.find(t=>t.exerciseId===id&&t.setNumber===setNumber)).filter(Boolean);
  return values.length?{weight:values.reduce((a,t)=>a+t.weight,0)/values.length,reps:values.reduce((a,t)=>a+t.reps,0)/values.length,count:values.length}:null;
}
function volume(s) { return s.sets.reduce((sum,t)=>sum+t.weight*t.reps,0); }
function currentExerciseSets() { const s=activeSession(); return s && selectedExerciseId?s.sets.filter(t=>t.exerciseId===selectedExerciseId):[]; }
function nextSetNumber(id) { const s=activeSession(); return s?1+Math.max(0,...s.sets.filter(t=>t.exerciseId===id).map(t=>t.setNumber)):1; }
function prefillDraft() {
  if (!selectedExerciseId) return;
  const setNumber=nextSetNumber(selectedExerciseId);
  const here=currentExerciseSets().slice(-1)[0];
  const prev=previousSet(selectedExerciseId,setNumber)?.set || previousSet(selectedExerciseId,1)?.set;
  const value=here || prev;
  draft={weight:value?.weight ?? 0, reps:value?.reps ?? 10, setNumber, exerciseId:selectedExerciseId};
}
function notify(message, error=false) {
  toastEl.textContent=message;
  toastEl.className=`toast show ${error?'error':''}`;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>toastEl.className='toast',3900);
}
async function commit(change) {
  if (busy) return false;
  busy=true;
  try {
    const newData=structuredClone(data);
    change(newData);
    await writeData(newData);
    data=newData;
    return true;
  } catch(e) { console.error(e); notify(e.message||'Unable to save. Try again.',true); return false; }
  finally {busy=false;}
}
function actionButton(action,label,cls='',attrs='') { return `<button class="${cls}" data-action="${action}" ${attrs}>${label}</button>`; }
const navItems=[['home','Overview','home'],['session','Workout','dumbbell'],['history','History','history'],['insights','Insights','trend'],['exercises','Exercises','activity'],['settings','Settings','settings']];
function navigation(mobile=false) { return navItems.map(([key,label,glyph])=>`<button class="${mobile?'bottom-link':'nav-link'} ${view===key?'active':''}" data-action="nav" data-view="${key}" ${view===key?'aria-current="page"':''}>${icon(glyph,mobile?22:20)}<span>${label}</span>${key==='session'&&activeSession()?'<span class="nav-dot"></span>':''}</button>`).join(''); }
function render() {
  if (!data) return;
  syncRestTimer();
  const titles={home:'Overview',session:'Workout',history:'Training history',insights:'Insights',exercises:'Exercise library',settings:'Settings'};
  app.innerHTML=`<div class="shell"><aside class="sidebar">
    <button class="brand" data-action="nav" data-view="home" aria-label="Setwise home"><span class="brand-mark">S<span>.</span></span><span class="brand-name">setwise<span class="muted-dot">.</span><small>THE PERSONAL TRAINING LOG</small></span></button>
    <div class="nav-label">YOUR SPACE</div><nav aria-label="Main navigation">${navigation()}</nav>
    <div class="side-bottom"><div class="local-pill"><span class="local-dot"></span> Private by design</div><p>Stored on this device.<br/>No account. No subscription.</p><span class="version">VERSION ${APP_VERSION}</span></div>
    </aside><div class="main"><header class="topbar"><div class="top-title">${esc(titles[view])}<span class="top-divider">/</span><span class="top-subtitle">${formatDate(new Date(),{weekday:'short',day:'numeric',month:'short'})}</span></div><div class="top-actions"><span class="offline-chip">${icon('check',15)} LOCAL FIRST</span><div class="avatar">SW</div></div></header>
    <main class="page" id="main-content">${renderContent()}</main></div><nav class="bottom-nav" aria-label="Main navigation">${navigation(true)}</nav></div>
    ${renderModal()}`;
  updateRestTimer();
}
function renderContent() {
  switch(view) {
    case 'home':return renderHome(); case 'session':return renderSession(); case 'history':return renderHistory();
    case 'insights':return renderInsights(); case 'exercises':return renderExercises(); case 'settings':return renderSettings();
    default:return renderHome();
  }
}
function renderHome() {
  const finished=allCompleted();
  const now=new Date(); const since=Date.now()-7*24*60*60*1000;
  const weekly=finished.filter(s=>Date.parse(s.endedAt)>since);
  const weeklySets=weekly.reduce((a,s)=>a+s.sets.length,0);
  const weeklyVolume=weekly.reduce((a,s)=>a+volume(s),0);
  const active=activeSession();
  const sessionsSinceBackup=finished.filter(s=>!data.settings.lastBackupAt || Date.parse(s.endedAt)>Date.parse(data.settings.lastBackupAt)).length;
  return `<div class="page-enter"><div class="hero"><div class="hero-copy"><div class="eyebrow"><span class="eyebrow-line"></span> YOUR PERSONAL TRAINING SPACE</div><h1>Every rep<br/><em>adds up.</em></h1><p>Stay consistent. See the progress.<br/>Keep every workout in one place.</p>${active?`<button class="btn btn-accent hero-button" data-action="resume">${icon('arrow')} Resume your ${esc(active.bodyPart)} session</button>`:''}</div><div class="hero-art" aria-hidden="true"><div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div><div class="hero-x">${icon('activity',96)}</div><div class="hero-art-caption">TRAIN / TRACK / PROGRESS</div></div></div>
    <div class="stats-grid"><div class="stat"><span class="stat-label">WORKOUTS <span>LAST 7 DAYS</span></span><strong>${weekly.length.toString().padStart(2,'0')}</strong><div class="stat-foot">Completed sessions</div></div><div class="stat"><span class="stat-label">TOTAL SETS <span>LAST 7 DAYS</span></span><strong>${weeklySets.toString().padStart(2,'0')}</strong><div class="stat-foot">Every set counts</div></div><div class="stat"><span class="stat-label">TRAINING VOLUME <span>LAST 7 DAYS</span></span><strong>${fmtNum(weeklyVolume,0)}<small> kg</small></strong><div class="stat-foot">Weight × reps</div></div></div>
    ${active?`<div class="active-callout"><div><span class="overline">SESSION IN PROGRESS</span><h3>${esc(active.bodyPart)} day <span class="soft">• ${active.sets.length} sets saved</span></h3></div><button class="btn btn-accent btn-sm" data-action="resume">Continue ${icon('arrow',17)}</button></div>`:''}
    <div class="section-heading"><div><div class="eyebrow">LET'S GET TO WORK</div><h2>What are we training today?</h2></div><span class="section-meta">${GROUPS.length} TRAINING GROUPS</span></div>
    <div class="group-grid">${GROUPS.map((group,index)=>{
      const count=data.exercises.filter(e=>e.bodyPart===group&&!e.archived).length;
      const last=finished.find(s=>s.bodyPart===group);
      return `<button class="group-card" data-action="start" data-group="${esc(group)}"><div class="group-top"><span class="group-number">0${index+1}</span><span class="group-arrow">${icon('arrow',20)}</span></div><div class="group-monogram">${groupCode(group)}</div><h3>${esc(group)}</h3><p>${esc(groupDescription(group))}</p><div class="group-footer"><span>${count} EXERCISES</span><span>${last?formatDate(last.endedAt,{day:'numeric',month:'short'}):'NOT YET TRAINED'}</span></div></button>`;}).join('')}</div>
    ${!data.settings.lastBackupAt && finished.length>=3?`<div class="notice">${icon('info')} <span>You have ${finished.length} completed workouts. Export a recovery backup in Settings to protect your history.</span><button class="text-btn" data-action="nav" data-view="settings">Back up</button></div>`:sessionsSinceBackup>=7?`<div class="notice">${icon('info')} <span>${sessionsSinceBackup} workouts since your last backup. Consider exporting a fresh recovery file.</span><button class="text-btn" data-action="nav" data-view="settings">Back up</button></div>`:''}
    </div>`;
}
function renderSession() {
  const s=activeSession();
  if(!s) return `<div class="page-enter"><div class="section-heading"><div><div class="eyebrow">START FRESH</div><h1>Choose a workout.</h1><p class="subheading">Select a training group to begin logging your sets.</p></div></div><div class="group-grid">${GROUPS.map(group=>`<button class="group-card compact" data-action="start" data-group="${esc(group)}"><span class="group-monogram">${groupCode(group)}</span><h3>${esc(group)}</h3><p>${data.exercises.filter(e=>e.bodyPart===group&&!e.archived).length} exercises</p></button>`).join('')}</div></div>`;
  if(selectedExerciseId && (!getExercise(selectedExerciseId) || (getExercise(selectedExerciseId).bodyPart!==s.bodyPart))) selectedExerciseId=null;
  const completedExercises=[...new Set(s.sets.map(t=>t.exerciseId))].length;
  const header=`<div class="workout-strip"><div><div class="eyebrow">CURRENT WORKOUT</div><h2>${esc(s.bodyPart)} <span class="workout-title-light">/ ${formatDate(s.startedAt,{day:'numeric',month:'short'})}</span></h2><div class="session-metrics">${icon('clock',16)} Started ${formatTime(s.startedAt)} <span class="metric-sep">•</span> ${s.sets.length} sets recorded <span class="metric-sep">•</span> ${completedExercises} exercises</div></div><div class="workout-strip-actions">${restTimerMarkup()}<button class="btn btn-outline" data-action="finish-session">Finish workout ${icon('check',17)}</button></div></div>`;
  if(!selectedExerciseId) {
    const options=data.exercises.filter(e=>e.bodyPart===s.bodyPart && (!e.archived || s.sets.some(t=>t.exerciseId===e.id))).sort((a,b)=>(a.order-b.order)||a.name.localeCompare(b.name));
    return `<div class="page-enter">${header}<div class="section-heading compact-head"><div><div class="eyebrow">STEP 01 — SELECT</div><h2>Choose your exercise</h2><p class="subheading">Last session results appear beside every machine.</p></div>${actionButton('new-exercise',`${icon('plus',16)} Add exercise`,'btn btn-outline btn-sm',`data-group="${esc(s.bodyPart)}"`)}</div>
      <div class="exercise-picker">${options.length?options.map((e,i)=>{
        const last=exerciseSessions(e.id,1)[0];const sets=s.sets.filter(t=>t.exerciseId===e.id).length;
        const maxLast=last?Math.max(...last.sets.filter(t=>t.exerciseId===e.id).map(t=>t.weight)):null;
        const today=nextWorkoutTarget(exerciseSessions(e.id,2),e.id,data.settings.incrementKg);
        return `<button class="exercise-pick" data-action="open-exercise" data-id="${esc(e.id)}"><span class="exercise-index">${String(i+1).padStart(2,'0')}</span><div class="exercise-pick-copy"><strong>${esc(e.name)}</strong><span>${last?`Last ${formatDate(last.endedAt,{day:'numeric',month:'short'})} · ${fmtNum(maxLast)} kg top set`:'First session · Set your baseline'}</span><span class="exercise-pick-goal">${icon('spark',13)} ${esc(today.title)}</span></div>${sets?`<span class="completed-tag">${sets} SET${sets===1?'':'S'} ${icon('check',14)}</span>`:`<span class="exercise-target">${e.targetSets} SET TARGET</span>`}<span class="pick-chevron">${icon('chevron')}</span></button>`;
      }).join(''):`<div class="empty-state">No exercises yet. Add a machine to start logging.</div>`}</div>
    </div>`;
  }
  const e=getExercise(selectedExerciseId), setNumber=nextSetNumber(e.id);
  if(!draft||draft.exerciseId!==e.id||draft.setNumber!==setNumber) prefillDraft();
  const prev=previousSet(e.id,setNumber), avg=averageForSet(e.id,setNumber), here=currentExerciseSets();
  const completedForExercise=exerciseSessions(e.id,5);
  const avgVolume=averageExerciseVolume(completedForExercise,e.id);
  const currentTotal=here.reduce((n,t)=>n+t.weight*t.reps,0);
  const currentAvgWeight=here.length?here.reduce((n,t)=>n+t.weight,0)/here.length:null;
  const estimateSets=[...here,...completedForExercise.flatMap(session=>session.sets.filter(t=>t.exerciseId===e.id))];
  const estimatedSix=sixRepEstimate(estimateSets);
  const goal=nextSetTarget(here,exerciseSessions(e.id,2),e.id,data.settings.incrementKg);
  const prevText=prev?.set ? `${fmtNum(prev.set.weight)} <small>kg</small> <span class="divide-symbol">×</span> ${prev.set.reps} <small>reps</small>` : '—';
  const avgText=avg?`${fmtNum(avg.weight)} <small>kg</small> <span class="divide-symbol">×</span> ${fmtNum(avg.reps)} <small>reps</small>`:'—';
  return `<div class="page-enter">${header}<button class="crumb" data-action="choose-exercise">${icon('back',17)} All ${esc(s.bodyPart)} exercises</button><div class="log-grid"><section class="entry-panel"><div class="eyebrow">NOW TRAINING</div><div class="entry-heading"><div><h1>${esc(e.name)}</h1><p>Set ${setNumber} ${here.length?`· ${here.length} already completed`:''} · Target ${e.targetSets} sets</p></div><span class="set-counter">${String(setNumber).padStart(2,'0')} <small>/ SET</small></span></div>
      <div class="reference-grid"><div class="reference-card"><span class="reference-label">${icon('history',16)} PREVIOUS SESSION</span><strong>${prevText}</strong><small>${prev?formatDate(prev.session.endedAt):'No previous performance'}</small></div><div class="reference-card accent-ref"><span class="reference-label">${icon('trend',16)} AVERAGE · SET ${setNumber}</span><strong>${avgText}</strong><small>${avg?`Based on ${avg.count} recent session${avg.count===1?'':'s'}`:'Start logging to build an average'}</small></div></div>
      <div class="goal-card"><div class="goal-label">${icon('spark',17)} ${here.length?'NEXT SET TARGET':'TODAY’S TARGET'}</div><strong>${esc(goal.title)}</strong><p>${esc(goal.description)}</p><span>Targets assume a ${TARGET_REPS}-rep strength focus. They are suggestions, not required loads.</span></div>
      <div class="sixrm-card"><div><span class="reference-label">ESTIMATED MAX FOR 6 REPS</span><strong>${estimatedSix?`${fmtNum(estimatedSix.estimated6RM)} kg`:'Not enough data'}</strong></div><p>${estimatedSix?`Based on ${fmtNum(estimatedSix.sourceWeight)} kg × ${estimatedSix.sourceReps} reps (Epley formula).`:'Record a weighted set of 1–10 reps to calculate this.'} Approximate only; works best for sets close to failure. Do not treat it as an automatic lifting target.</p></div>
      <form id="log-set-form"><div class="entry-controls"><div class="numeric-field"><label for="weight-input">WEIGHT <span>KG</span></label><div class="input-row"><button type="button" class="stepper" data-action="step" data-field="weight" data-delta="-1" aria-label="Decrease weight">−</button><input id="weight-input" name="weight" type="number" inputmode="decimal" min="0" max="10000" step="any" value="${draft.weight}" required/><button type="button" class="stepper" data-action="step" data-field="weight" data-delta="1" aria-label="Increase weight">+</button></div><span class="field-note">Adjust by ${fmtNum(data.settings.incrementKg)} kg</span></div><div class="numeric-field"><label for="reps-input">REPETITIONS <span>REPS</span></label><div class="input-row"><button type="button" class="stepper" data-action="step" data-field="reps" data-delta="-1" aria-label="Decrease repetitions">−</button><input id="reps-input" name="reps" type="number" inputmode="numeric" min="1" max="10000" step="1" value="${draft.reps}" required/><button type="button" class="stepper" data-action="step" data-field="reps" data-delta="1" aria-label="Increase repetitions">+</button></div><span class="field-note">One rep at a time</span></div></div>
      <div class="entry-actions"><button type="submit" name="next" value="set" class="btn btn-accent btn-large">Save & next set ${icon('arrow',21)}</button><button type="submit" name="next" value="exercise" class="btn btn-outline btn-large">Save & next exercise ${icon('chevron',20)}</button></div></form>
      <div class="entry-help">${icon('info',16)} Each saved set is recorded immediately on this iPad.</div></section>
      <aside class="progress-panel"><div class="progress-heading"><div><div class="eyebrow">THIS WORKOUT</div><h3>Recorded sets</h3></div><span class="small-count">${here.length} / ${e.targetSets}</span></div>${here.length?`<div class="set-list">${here.map(t=>`<div class="set-row"><span class="set-number">SET ${String(t.setNumber).padStart(2,'0')}</span><strong>${fmtNum(t.weight)} <small>kg</small> <span>×</span> ${t.reps}</strong><button class="icon-button" title="Edit saved set" aria-label="Edit saved set" data-action="edit-set" data-id="${esc(t.id)}" data-session="${esc(s.id)}">${icon('edit',16)}</button></div>`).join('')}</div>`:`<div class="empty-mini">Your first set starts here. Each saved set will appear in this panel.</div>`}
      ${here.length?`<button class="subtle-action" data-action="undo-set">${icon('trash',15)} Delete last set</button>`:''}<div class="progress-bottom"><span>CURRENT EXERCISE VOLUME</span><strong>${fmtNum(currentTotal,0)} <small>kg</small></strong><div class="exercise-average"><span>AVERAGE EXERCISE VOLUME · LAST ${avgVolume?.count||0} WORKOUTS</span><strong>${avgVolume?fmtNum(avgVolume.average,0):'—'} <small>${avgVolume?'kg':''}</small></strong></div><div class="exercise-average"><span>AVERAGE WEIGHT PER SET · TODAY</span><strong>${currentAvgWeight!==null?fmtNum(currentAvgWeight):'—'} <small>${currentAvgWeight!==null?'kg':''}</small></strong></div></div></aside></div></div>`;
}
function renderHistory() {
  const sessions=allCompleted(), total=sessions.length;
  if(historySessionId) {
    const s=data.sessions.find(t=>t.id===historySessionId && t.endedAt);
    if(!s) historySessionId=null;
    else {
      const byExercise=[...new Set(s.sets.map(t=>t.exerciseId))];
      return `<div class="page-enter"><button class="crumb" data-action="history-back">${icon('back',17)} Back to history</button><div class="section-heading"><div><div class="eyebrow">WORKOUT RECORD</div><h1>${esc(s.bodyPart)} · ${formatDate(s.endedAt)}</h1><p class="subheading">Started ${formatTime(s.startedAt)} · Finished ${formatTime(s.endedAt)}</p></div><button class="btn btn-outline danger-outline" data-action="delete-session" data-id="${esc(s.id)}">${icon('trash',17)} Delete workout</button></div>
        <div class="stats-grid slim"><div class="stat"><span class="stat-label">TOTAL SETS</span><strong>${s.sets.length}</strong></div><div class="stat"><span class="stat-label">EXERCISES</span><strong>${byExercise.length}</strong></div><div class="stat"><span class="stat-label">VOLUME</span><strong>${fmtNum(volume(s),0)}<small> kg</small></strong></div></div>
        ${byExercise.map(id=>{const e=getExercise(id);return `<section class="history-detail"><div class="history-detail-title"><h3>${esc(e?.name||'Unknown exercise')}</h3><span>${s.sets.filter(t=>t.exerciseId===id).length} sets</span></div><div class="history-table"><div class="history-row table-head"><span>SET</span><span>WEIGHT</span><span>REPS</span><span>VOLUME</span><span></span></div>${s.sets.filter(t=>t.exerciseId===id).sort((a,b)=>a.setNumber-b.setNumber).map(t=>`<div class="history-row"><span>${t.setNumber}</span><span>${fmtNum(t.weight)} kg</span><span>${t.reps}</span><span>${fmtNum(t.weight*t.reps,0)} kg</span><button class="icon-button" aria-label="Edit set" data-action="edit-set" data-id="${esc(t.id)}" data-session="${esc(s.id)}">${icon('edit',17)}</button></div>`).join('')}</div></section>`;}).join('')}
      </div>`;
    }
  }
  return `<div class="page-enter"><div class="section-heading"><div><div class="eyebrow">EVERY SESSION, KEPT</div><h1>Training history.</h1><p class="subheading">All your completed workouts, stored locally.</p></div><span class="section-meta">${total} COMPLETED</span></div>
    ${sessions.length?`<div class="history-list">${sessions.map(s=>`<button class="history-card" data-action="history-open" data-id="${esc(s.id)}"><span class="history-date"><strong>${formatDate(s.endedAt,{day:'2-digit'})}</strong><small>${formatDate(s.endedAt,{month:'short',year:'numeric'})}</small></span><div class="history-main"><strong>${esc(s.bodyPart)} day</strong><small>${s.sets.length} sets · ${new Set(s.sets.map(t=>t.exerciseId)).size} exercises · ${formatTime(s.endedAt)}</small></div><span class="history-vol">${fmtNum(volume(s),0)} <small>kg</small></span>${icon('chevron',19)}</button>`).join('')}</div>`:`<div class="empty-state large-empty">${icon('history',36)}<h3>No workouts recorded yet.</h3><p>Finish your first session to start building your history.</p><button class="btn btn-accent" data-action="nav" data-view="session">Start training ${icon('arrow',17)}</button></div>`}</div>`;
}
function graphForExercise(id) {
  const sessions=exerciseSessions(id,12).reverse();
  if(!sessions.length) return `<div class="empty-chart">No logged sessions for this exercise yet. Your trend will appear here.</div>`;
  const pts=sessions.map((s,i)=>({i,v:Math.max(...s.sets.filter(t=>t.exerciseId===id).map(t=>t.weight)),label:formatDate(s.endedAt,{day:'numeric',month:'short'})}));
  const lo=Math.min(...pts.map(t=>t.v));const hi=Math.max(...pts.map(t=>t.v));
  const min=Math.max(0, lo-(hi-lo||10)*.4),max=hi+(hi-lo||10)*.3;
  const W=760,H=258, left=47,right=28,top=30,bottom=47;
  const x=(i)=>left+(pts.length===1?(W-left-right)/2:i*(W-left-right)/(pts.length-1));
  const y=(v)=>top+(max-v)/Math.max(1,max-min)*(H-top-bottom);
  const coords=pts.map((p,i)=>[x(i),y(p.v)]);
  const path=coords.map(([px,py],i)=>`${i===0?'M':'L'} ${px.toFixed(2)} ${py.toFixed(2)}`).join(' ');
  const area=path+` L ${coords[coords.length-1][0]} ${H-bottom} L ${coords[0][0]} ${H-bottom} Z`;
  const lines=[0,.5,1].map(f=>{const val=min+(max-min)*f; return `<line x1="${left}" y1="${y(val)}" x2="${W-right}" y2="${y(val)}" stroke="#2e373c" stroke-dasharray="4 6"/><text x="${left-12}" y="${y(val)+4}" font-size="12" text-anchor="end" fill="#8a999a">${Math.round(val)}</text>`;}).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Maximum weight per session chart"><defs><linearGradient id="fillChart" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#c8fa71" stop-opacity=".25"/><stop offset="100%" stop-color="#c8fa71" stop-opacity="0"/></linearGradient></defs>${lines}<path d="${area}" fill="url(#fillChart)"/><path d="${path}" fill="none" stroke="#c8fa71" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${coords.map(([px,py],i)=>`<circle cx="${px}" cy="${py}" r="5" fill="#c8fa71" stroke="#121b1b" stroke-width="3"><title>${pts[i].label}: ${pts[i].v} kg</title></circle>`).join('')}<text x="${left}" y="${H-10}" font-size="12" fill="#899a9a">${pts[0].label}</text><text x="${W-right}" y="${H-10}" font-size="12" fill="#899a9a" text-anchor="end">${pts[pts.length-1].label}</text></svg>`;
}
function renderInsights() {
  const activeExercises=data.exercises.filter(e=>exerciseSessions(e.id,1).length).sort((a,b)=>a.name.localeCompare(b.name));
  if(!insightsExerciseId||!getExercise(insightsExerciseId)||!activeExercises.some(e=>e.id===insightsExerciseId)) insightsExerciseId=activeExercises[0]?.id||null;
  const ex=insightsExerciseId?getExercise(insightsExerciseId):null;
  const sessions=ex?exerciseSessions(ex.id):[];
  const best=ex&&sessions.length?Math.max(...sessions.flatMap(s=>s.sets.filter(t=>t.exerciseId===ex.id).map(t=>t.weight))):null;
  return `<div class="page-enter"><div class="section-heading"><div><div class="eyebrow">THE LONG VIEW</div><h1>Progress, made visible.</h1><p class="subheading">See how your strength develops from session to session.</p></div></div>
    ${activeExercises.length?`<div class="insights-toolbar"><label for="insight-select">EXERCISE</label><select id="insight-select">${activeExercises.map(e=>`<option value="${esc(e.id)}" ${e.id===insightsExerciseId?'selected':''}>${esc(e.name)} · ${esc(e.bodyPart)}</option>`).join('')}</select></div><div class="stats-grid slim"><div class="stat"><span class="stat-label">SESSIONS TRACKED</span><strong>${sessions.length}</strong></div><div class="stat"><span class="stat-label">HEAVIEST SET</span><strong>${fmtNum(best)}<small> kg</small></strong></div><div class="stat"><span class="stat-label">LATEST SESSION</span><strong class="small-date">${formatDate(sessions[0].endedAt,{day:'numeric',month:'short',year:'2-digit'})}</strong></div></div>
    <section class="insights-chart"><div class="chart-heading"><div><div class="eyebrow">WEIGHT PROGRESSION</div><h3>${esc(ex.name)}</h3><p>Maximum weight recorded per session · last 12 sessions</p></div><span class="legend"><span></span> TOP WEIGHT (KG)</span></div>${graphForExercise(ex.id)}</section>
    <section class="history-detail"><div class="history-detail-title"><h3>Average by set number</h3><span>Last 5 sessions</span></div><div class="history-table"><div class="history-row averages-head"><span>SET</span><span>AVG WEIGHT</span><span>AVG REPS</span><span>SESSIONS</span></div>${Array.from({length:Math.max(3,...sessions.slice(0,5).flatMap(s=>s.sets.filter(t=>t.exerciseId===ex.id).map(t=>t.setNumber)))},(_,i)=>i+1).slice(0,20).map(n=>{const a=averageForSet(ex.id,n,5);return `<div class="history-row averages-head"><span>${n}</span><span>${a?fmtNum(a.weight)+' kg':'—'}</span><span>${a?fmtNum(a.reps):'—'}</span><span>${a?.count||'—'}</span></div>`;}).join('')}</div></section>`:
    `<div class="empty-state large-empty">${icon('trend',36)}<h3>Progress starts with your first workout.</h3><p>When you finish a session, charts and set-by-set averages will appear here.</p><button class="btn btn-accent" data-action="nav" data-view="session">Start a workout ${icon('arrow',17)}</button></div>`}</div>`;
}
function renderExercises() {
  const list=data.exercises.filter(e=>e.bodyPart===manageGroup&&(includeArchived||!e.archived)).sort((a,b)=>a.archived-b.archived||a.order-b.order||a.name.localeCompare(b.name));
  return `<div class="page-enter"><div class="section-heading"><div><div class="eyebrow">YOUR EXERCISE LIBRARY</div><h1>Make it yours.</h1><p class="subheading">Add machines, rename exercises and set your usual target sets.</p></div><button class="btn btn-accent" data-action="new-exercise" data-group="${esc(manageGroup)}">${icon('plus',18)} Add exercise</button></div>
    <div class="group-tabs" role="group" aria-label="Exercise groups">${GROUPS.map(g=>`<button class="group-tab ${g===manageGroup?'selected':''}" data-action="manage-group" data-group="${esc(g)}">${esc(g)}</button>`).join('')}</div><label class="check-option"><input type="checkbox" id="show-archived" ${includeArchived?'checked':''}/> Show archived exercises</label>
    <div class="library-list">${list.map((e,i)=>`<div class="library-row ${e.archived?'archived':''}"><span class="library-index">${String(i+1).padStart(2,'0')}</span><div class="library-name"><strong>${esc(e.name)}</strong><small>${e.targetSets} target sets ${e.archived?'· Archived':''}</small></div><button class="icon-button" data-action="edit-exercise" data-id="${esc(e.id)}" aria-label="Edit ${esc(e.name)}">${icon('edit',18)}</button><button class="icon-button" data-action="${e.archived?'restore-exercise':'archive-exercise'}" data-id="${esc(e.id)}" aria-label="${e.archived?'Restore':'Archive'} ${esc(e.name)}">${icon(e.archived?'refresh':'trash',18)}</button></div>`).join('')||`<div class="empty-state">No exercises in this group. Add the first one.</div>`}</div>
    <div class="library-note">${icon('info',18)} Archiving hides an exercise from new workout lists without deleting any historical sets.</div></div>`;
}
function renderSettings() {
  const count=data.sessions.length, sets=data.sessions.reduce((n,s)=>n+s.sets.length,0);
  return `<div class="page-enter"><div class="section-heading"><div><div class="eyebrow">CONTROL YOUR EXPERIENCE</div><h1>Settings & your data.</h1><p class="subheading">No login. No cloud sync. Your records belong to you.</p></div></div>
    <div class="settings-grid"><section class="settings-card"><div class="settings-icon">${icon('settings',23)}</div><h3>Workout preferences</h3><p>How much should the weight +/- buttons change each time?</p><form id="preferences-form" class="preferences-form"><label for="increment-kg">WEIGHT STEP (KG)</label><div><input type="number" id="increment-kg" min="0.1" max="100" step="any" value="${data.settings.incrementKg}" required/><button class="btn btn-accent" type="submit">Save preference</button></div></form></section>
    <section class="settings-card"><div class="settings-icon">${icon('folder',23)}</div><h3>Local storage</h3><p>All sets are stored in your iPad's local app database, separate from the app code.</p><div class="storage-metrics"><span>${count} workouts</span><span>${sets} sets</span></div><div class="storage-metrics"><span>Storage: IndexedDB</span><span>No account</span></div></section>
    <section class="settings-card"><div class="settings-icon">${icon('download',23)}</div><h3>Recovery backup</h3><p>Save a complete JSON backup to Files. This preserves your exercises and every recorded set.</p><button class="btn btn-accent wide" data-action="export-json">${icon('download',17)} Export full backup</button><span class="settings-note">${data.settings.lastBackupAt?`Last export initiated: ${formatDate(data.settings.lastBackupAt)}`:'No backup exported from this installation yet.'}</span></section>
    <section class="settings-card"><div class="settings-icon">${icon('activity',23)}</div><h3>Apple Numbers export</h3><p>Export all logged sets as a CSV file. Open or import that file in Apple Numbers.</p><button class="btn btn-outline wide" data-action="export-csv">${icon('download',17)} Export Numbers CSV</button><span class="settings-note">This is a snapshot; an existing Numbers sheet will not sync automatically.</span></section>
    <section class="settings-card restore-card"><div class="settings-icon">${icon('upload',23)}</div><h3>Restore from backup</h3><p>Use an earlier Setwise JSON backup to restore your full workout history.</p><button class="btn btn-outline wide" data-action="import-json">${icon('upload',17)} Choose backup file</button><span class="settings-note warning">Restoring replaces the data currently in this installation. Export a backup first.</span></section>
    <section class="settings-card"><div class="settings-icon">${icon('info',23)}</div><h3>About Setwise</h3><p>Version ${APP_VERSION} · Data schema ${DATA_SCHEMA_VERSION}<br/>Built for offline, private personal fitness tracking.</p><p>App updates preserve the local database when installed at the same website address.</p><p class="settings-note">iPadOS may clear locally stored website data. Export backups to Files regularly and before major updates.</p></section></div></div>`;
}
function renderModal() {
  if(!modal) return '';
  if(modal.type==='exercise') {
    const e=modal.id?getExercise(modal.id):null;
    return `<div class="modal-backdrop"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="dialog-title"><div><div class="eyebrow">EXERCISE DETAILS</div><h2 id="modal-title">${e?'Edit exercise':'New exercise'}</h2></div><button class="icon-button" data-action="close-modal" aria-label="Close">${icon('close',21)}</button></div>
      <form id="exercise-form"><label for="exercise-name">EXERCISE NAME</label><input id="exercise-name" name="name" maxlength="160" required placeholder="e.g. Incline Chest Press" value="${e?esc(e.name):''}"/><label for="exercise-group">BODY PART</label><select id="exercise-group" name="bodyPart">${GROUPS.map(g=>`<option value="${esc(g)}" ${g===(e?.bodyPart||modal.group)?'selected':''}>${esc(g)}</option>`).join('')}</select><label for="exercise-target">DEFAULT TARGET SETS</label><input type="number" id="exercise-target" name="targetSets" min="1" max="20" step="1" value="${e?.targetSets||3}" required/><button type="submit" class="btn btn-accent wide">${e?'Save changes':'Add exercise'} ${icon('check',17)}</button></form></div></div>`;
  }
  if(modal.type==='edit-set') {
    const s=data.sessions.find(s=>s.id===modal.sessionId),t=s?.sets.find(t=>t.id===modal.id),e=t?getExercise(t.exerciseId):null;
    if(!t) return '';
    return `<div class="modal-backdrop"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="dialog-title"><div><div class="eyebrow">CORRECT A RECORD</div><h2 id="modal-title">${esc(e?.name||'Exercise')} · Set ${t.setNumber}</h2></div><button class="icon-button" data-action="close-modal" aria-label="Close">${icon('close',21)}</button></div><form id="edit-set-form"><label for="edit-weight">WEIGHT (KG)</label><input type="number" id="edit-weight" name="weight" min="0" max="10000" step="any" required value="${t.weight}"/><label for="edit-reps">REPETITIONS</label><input type="number" id="edit-reps" name="reps" min="1" max="10000" step="1" required value="${t.reps}"/><button type="submit" class="btn btn-accent wide">Save correction ${icon('check',17)}</button></form></div></div>`;
  }
  return '';
}
async function setView(v) {
  if(!navItems.some(x=>x[0]===v)) return;
  view=v; if(v==='session'&&!activeSession()) selectedExerciseId=null;
  historySessionId=null;
  render(); window.scrollTo({top:0,behavior:'instant'});
}
async function saveSet(next) {
  const s=activeSession(); if(!s || !selectedExerciseId) return;
  const weight=Number(document.getElementById('weight-input')?.value);
  const reps=Number(document.getElementById('reps-input')?.value);
  if(!Number.isFinite(weight)||weight<0||weight>10000||!Number.isInteger(reps)||reps<1||reps>10000) { notify('Enter a valid weight and a whole number of reps.',true); return; }
  const id=selectedExerciseId, setNumber=nextSetNumber(id);
  const ok=await commit(d=>{
    const session=d.sessions.find(t=>t.id===s.id);
    session.sets.push({id:makeId(),exerciseId:id,setNumber,weight,reps,createdAt:new Date().toISOString()});
  });
  if(ok) {
    if(next==='exercise') { selectedExerciseId=null; draft=null; notify('Set saved. Choose the next exercise.'); }
    else { draft={weight,reps,setNumber:setNumber+1,exerciseId:id}; notify(`Set ${setNumber} saved.`); }
    render();
  }
}
async function exportFile(filename,mimetype,content) {
  const file=new File([content],filename,{type:mimetype});
  if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) {
    try { await navigator.share({files:[file],title:'Setwise export'});return true; }
    catch(e) { if(e.name==='AbortError') return false; console.warn('Share unavailable, trying download',e); }
  }
  try {
    const url=URL.createObjectURL(file),link=document.createElement('a');
    link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    return true;
  } catch(e) { notify('Export failed. Please try again.',true);return false; }
}
async function backup() {
  const snapshot=structuredClone(data);
  const text=JSON.stringify({app:'Setwise',formatVersion:1,exportedAt:new Date().toISOString(),data:snapshot},null,2);
  const ok=await exportFile(`setwise-backup-${dayKey(new Date())}.json`,'application/json',text);
  if(ok){await commit(d=>{d.settings.lastBackupAt=new Date().toISOString();});render();notify('Backup prepared. Save it to Files or another safe location.');}
}
function quoteCSV(value){const raw=String(value??'');const t=/^[\s]*[=+@-]/.test(raw)?`'${raw}`:raw;return `"${t.replace(/"/g,'""')}"`;}
function dataCSV() {
  const rows=[['Date','Time','Body Part','Exercise','Set Number','Weight (kg)','Repetitions','Volume (kg)','Session ID','Set ID','Status']];
  for(const s of [...data.sessions].sort((a,b)=>Date.parse(a.startedAt)-Date.parse(b.startedAt))) for(const t of s.sets) {
    const ex=getExercise(t.exerciseId);
    rows.push([dayKey(t.createdAt),formatTime(t.createdAt),s.bodyPart,ex?.name||'Unknown',t.setNumber,t.weight,t.reps,t.weight*t.reps,s.id,t.id,s.endedAt?'Completed':'In progress']);
  }
  return '\ufeff'+rows.map(row=>row.map(quoteCSV).join(',')).join('\r\n')+'\r\n';
}
async function csvExport(){const ok=await exportFile(`setwise-numbers-${dayKey(new Date())}.csv`,'text/csv;charset=utf-8',dataCSV());if(ok)notify('CSV prepared. Open it in Numbers via Files.');}

app.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');if(!el||!app.contains(el))return;
  const action=el.dataset.action,id=el.dataset.id,group=el.dataset.group;
  switch(action) {
    case 'nav': await setView(el.dataset.view); break;
    case 'start': {
      const active=activeSession();
      if(active && active.bodyPart!==group){notify(`Finish your ${active.bodyPart} session before starting ${group}.`,true); view='session';selectedExerciseId=null;render();break;}
      if(!active) { const ok=await commit(d=>d.sessions.push({id:makeId(),bodyPart:group,startedAt:new Date().toISOString(),endedAt:null,sets:[]})); if(!ok)break; }
      selectedExerciseId=null;draft=null;view='session';render();break;
    }
    case 'resume':view='session';selectedExerciseId=null;draft=null;render();break;
    case 'choose-exercise':selectedExerciseId=null;draft=null;render();break;
    case 'open-exercise':selectedExerciseId=id;draft=null;prefillDraft();render();break;
    case 'step': {
      const input=document.getElementById(el.dataset.field==='weight'?'weight-input':'reps-input');
      if(!input)return;
      const step=el.dataset.field==='weight'?data.settings.incrementKg:1;
      const min=el.dataset.field==='weight'?0:1;
      const next=Math.max(min,Math.round((Number(input.value||0)+step*Number(el.dataset.delta))*1000)/1000);
      input.value=next;if(draft)draft[el.dataset.field]=next;break;
    }
    case 'finish-session': {
      const s=activeSession();if(!s)return;
      if(!s.sets.length) { if(!confirm('No sets have been recorded. Discard this empty workout?'))break;
        const ok=await commit(d=>{d.sessions=d.sessions.filter(x=>x.id!==s.id);});if(ok){selectedExerciseId=null;view='home';render();notify('Empty session discarded.');}break; }
      if(!confirm(`Finish ${s.bodyPart} workout with ${s.sets.length} recorded sets?`))break;
      const ok=await commit(d=>{d.sessions.find(t=>t.id===s.id).endedAt=new Date().toISOString();});
      if(ok){selectedExerciseId=null;draft=null;historySessionId=s.id;view='history';render();notify('Workout finished and saved.');}break;
    }
    case 'undo-set': {
      const s=activeSession(),sets=currentExerciseSets();if(!sets.length)return;
      const last=sets[sets.length-1];if(!confirm(`Delete set ${last.setNumber} (${last.weight} kg × ${last.reps})?`))break;
      const ok=await commit(d=>{const ss=d.sessions.find(t=>t.id===s.id);ss.sets=ss.sets.filter(t=>t.id!==last.id);});
      if(ok){draft=null;render();notify('Last set deleted.');}break;
    }
    case 'history-open':historySessionId=id;render();break;
    case 'history-back':historySessionId=null;render();break;
    case 'delete-session': {
      const s=data.sessions.find(s=>s.id===id);if(!s||!confirm(`Permanently delete ${s.bodyPart} workout from ${formatDate(s.endedAt)} and all its sets?`))break;
      const ok=await commit(d=>{d.sessions=d.sessions.filter(t=>t.id!==id);});if(ok){historySessionId=null;render();notify('Workout deleted.');}break;
    }
    case 'manage-group':manageGroup=group;render();break;
    case 'new-exercise':modal={type:'exercise',group:group||manageGroup};render();document.getElementById('exercise-name')?.focus();break;
    case 'edit-exercise':modal={type:'exercise',id};render();document.getElementById('exercise-name')?.focus();break;
    case 'archive-exercise': {
      const e=getExercise(id);if(!e||!confirm(`Archive ${e.name}? Your old workout records will be kept.`))break;
      if(await commit(d=>{d.exercises.find(t=>t.id===id).archived=true;})){render();notify('Exercise archived; historical sets preserved.');}break;
    }
    case 'restore-exercise':if(await commit(d=>{d.exercises.find(t=>t.id===id).archived=false;})){render();notify('Exercise restored.');}break;
    case 'edit-set':modal={type:'edit-set',id,sessionId:el.dataset.session};render();document.getElementById('edit-weight')?.focus();break;
    case 'close-modal':modal=null;render();break;
    case 'export-json':await backup();break;
    case 'export-csv':await csvExport();break;
    case 'import-json':importInput.value='';importInput.click();break;
  }
});

app.addEventListener('submit',async event=>{
  const form=event.target;
  if(!['log-set-form','exercise-form','edit-set-form','preferences-form'].includes(form.id))return;
  event.preventDefault();
  if(form.id==='log-set-form') { const btn=event.submitter; await saveSet(btn?.value==='exercise'?'exercise':'set'); return; }
  const values=new FormData(form);
  if(form.id==='exercise-form'){
    const name=String(values.get('name')||'').trim(),bodyPart=String(values.get('bodyPart')||''),targetSets=Number(values.get('targetSets'));
    if(!name||name.length>160||!GROUPS.includes(bodyPart)||!Number.isInteger(targetSets)||targetSets<1||targetSets>20){notify('Please check the exercise details.',true);return;}
    const edId=modal?.id;
    const ok=await commit(d=>{
      if(edId){const e=d.exercises.find(e=>e.id===edId);Object.assign(e,{name,bodyPart,targetSets});}
      else d.exercises.push({id:makeId(),name,bodyPart,targetSets,archived:false,order:Math.max(0,...d.exercises.map(e=>e.order||0))+1});
    });
    if(ok){manageGroup=bodyPart;modal=null;render();notify(edId?'Exercise updated.':'Exercise added.');}return;
  }
  if(form.id==='edit-set-form') {
    const weight=Number(values.get('weight')),reps=Number(values.get('reps'));
    if(!Number.isFinite(weight)||weight<0||weight>10000||!Number.isInteger(reps)||reps<1||reps>10000){notify('Please enter valid weight and reps.',true);return;}
    const {id,sessionId}=modal;
    if(await commit(d=>{const t=d.sessions.find(s=>s.id===sessionId).sets.find(t=>t.id===id);t.weight=weight;t.reps=reps;})) {modal=null;draft=null;render();notify('Set corrected.');}return;
  }
  if(form.id==='preferences-form') {
    const step=Number(document.getElementById('increment-kg').value);
    if(!Number.isFinite(step)||step<=0||step>100){notify('Enter a weight step between 0.1 and 100.',true);return;}
    if(await commit(d=>{d.settings.incrementKg=step;})){render();notify('Preference saved.');}
  }
});

app.addEventListener('change',event=>{
  if(event.target.id==='insight-select'){insightsExerciseId=event.target.value;render();}
  else if(event.target.id==='show-archived'){includeArchived=event.target.checked;render();}
});
app.addEventListener('input',event=>{
  if(draft && (event.target.id==='weight-input'||event.target.id==='reps-input')){
    draft[event.target.id==='weight-input'?'weight':'reps']=event.target.value;
  }
});
importInput.addEventListener('change',async()=>{
  const file=importInput.files?.[0];if(!file)return;
  try{
    if(file.size>50*1024*1024)throw new Error('Backup file is too large.');
    const payload=JSON.parse(await file.text());
    if(payload.app!=='Setwise'||payload.formatVersion!==1||!payload.data)throw new Error('This is not a supported Setwise recovery backup.');
    const replacement=validateData(payload.data);
    const summary=`Restore ${replacement.sessions.length} workouts, ${replacement.sessions.reduce((n,s)=>n+s.sets.length,0)} sets and ${replacement.exercises.length} exercises?\n\nThis REPLACES everything currently stored in this app. Export a current backup first if you want to keep it.`;
    if(!confirm(summary))return;
    if(await commit(d=>{Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,replacement);})){
      selectedExerciseId=null;draft=null;historySessionId=null;insightsExerciseId=null;view='home';modal=null;render();notify('Recovery backup restored successfully.');
    }
  } catch(e) {console.error(e);notify(e.message||'Unable to read backup.',true);}
  finally{importInput.value='';}
});

(async function start() {
  try {
    data=await loadData();
    render();
    setInterval(updateRestTimer,1000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateRestTimer();});
    if('serviceWorker' in navigator && location.protocol!=='file:') {
      navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline service worker not registered',e));
    }
  } catch(e) {
    console.error(e);
    app.innerHTML=`<div class="fatal"><h1>Unable to load your workout records</h1><p>${esc(e.message)}</p><p>Your database has not been overwritten. Do not clear website data. Check browser storage permissions or reload the app.</p><button class="btn btn-accent" onclick="location.reload()">Retry</button></div>`;
  }
})();
