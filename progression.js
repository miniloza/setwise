export const TARGET_REPS = 6;
const DEFAULT_REST_SECONDS = 120;
const isQualifying = t => t && t.kind === 'working' && Number.isFinite(t.weight) && t.weight > 0 && Number.isInteger(t.reps) && t.reps >= 1 && t.reps <= 10;
export function trainingVolume(sets) { return sets.filter(t=>t.kind!=='warmup').reduce((n,t)=>n+t.weight*t.reps,0); }
export function averageExerciseVolume(sessions, exerciseId, limit=5) {
  const values = sessions.filter(s=>s.endedAt).filter(s=>s.sets.some(t=>t.exerciseId===exerciseId)).slice(0,limit)
    .map(s=>trainingVolume(s.sets.filter(t=>t.exerciseId===exerciseId)));
  return values.length ? {average:values.reduce((a,b)=>a+b,0)/values.length,count:values.length} : null;
}
export function sixRepEstimate(sets) {
  const candidates = sets.filter(isQualifying).map(t=>({estimated6RM:t.weight*(1+t.reps/30)/(1+TARGET_REPS/30),sourceWeight:t.weight,sourceReps:t.reps}));
  return candidates.length ? candidates.sort((a,b)=>b.estimated6RM-a.estimated6RM)[0] : null;
}
export function restStatus(startedAt, restSeconds = DEFAULT_REST_SECONDS, now = Date.now()) {
  if(startedAt == null) return null;
  const cycle = Number.isFinite(restSeconds) && restSeconds >= 15 ? Math.round(restSeconds) : DEFAULT_REST_SECONDS;
  const elapsed = Math.max(0,Math.floor((now-startedAt)/1000));
  const inCycle = elapsed % cycle;
  const remaining = inCycle === 0 && elapsed > 0 ? 0 : cycle - inCycle;
  const secondsToShow = remaining === 0 ? 0 : remaining;
  return {seconds:secondsToShow,cyclesComplete:Math.floor(elapsed/cycle),ready:elapsed>=cycle && inCycle<8};
}
export function formatCountdown(seconds) { return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`; }
function lastSet(session, exerciseId) { return [...session.sets.filter(t=>t.exerciseId===exerciseId && t.kind==='working')].sort((a,b)=>b.setNumber-a.setNumber)[0] || null; }
function round1(n) { return Math.round(n*10)/10; }
function readyForSmallIncrease(lastTwo, exerciseId, step) {
  if(lastTwo.length<2) return false;
  const [latest, previous] = lastTwo.map(s=>lastSet(s, exerciseId));
  if(!latest||!previous||latest.reps<TARGET_REPS+2||previous.reps<TARGET_REPS+2||latest.weight<=0||Math.abs(latest.weight-previous.weight)>0.001) return false;
  if(step > latest.weight*.08+0.0001) return false;
  const implied = sixRepEstimate([latest]);
  return Boolean(implied && latest.weight + step <= implied.estimated6RM + 0.0001);
}
export function nextWorkoutTarget(completedSessions, exerciseId, step=2.5) {
  const lastTwo = completedSessions.filter(s=>s.endedAt && s.sets.some(t=>t.exerciseId===exerciseId && t.kind==='working')).slice(0,2);
  if(!lastTwo.length) return {kind:'new',title:'Set your baseline',description:`Start with a comfortable weight for ${TARGET_REPS} controlled reps.`};
  const last = lastSet(lastTwo[0],exerciseId);
  const weight = last.weight;
  if(weight<=0) return {kind:'new',title:'Set your baseline',description:'Record a weighted set to start building a target.'};
  if(readyForSmallIncrease(lastTwo,exerciseId,step)) return {kind:'up',weight:round1(weight+step),reps:TARGET_REPS,title:`Aim for ${round1(weight+step)} kg × ${TARGET_REPS}`,description:`A small +${round1(step)} kg trial looks reasonable based on two strong recent first working sets.`};
  if(last.reps>=TARGET_REPS+2) return {kind:'hold',weight,reps:TARGET_REPS+2,title:`Repeat ${round1(weight)} kg × ${TARGET_REPS+2}`,description:'Repeat a strong first working set next session before increasing load.'};
  return {kind:'hold',weight,reps:Math.max(TARGET_REPS,Math.min(TARGET_REPS+2,last.reps+1)),title:`Build on ${round1(weight)} kg`,description:`Aim for ${Math.max(TARGET_REPS,Math.min(TARGET_REPS+2,last.reps+1))} controlled reps before adding weight.`};
}
export function nextSetTarget(currentSets, completedSessions, exerciseId, step=2.5) {
  const live = currentSets.filter(t=>t.kind==='working');
  if(!live.length) return nextWorkoutTarget(completedSessions, exerciseId, step);
  const last = [...live].sort((a,b)=>b.setNumber-a.setNumber)[0];
  if(last.weight<=0) return {kind:'hold',title:`Aim for ${TARGET_REPS} good reps`,description:'Choose an appropriate weight and prioritise controlled technique.'};
  const estimate = sixRepEstimate([last]);
  if(last.reps>=TARGET_REPS+2 && step<=last.weight*.08+0.0001 && estimate && last.weight+step<=estimate.estimated6RM+0.0001)
    return {kind:'up',weight:round1(last.weight+step),reps:TARGET_REPS,title:`Option: ${round1(last.weight+step)} kg × ${TARGET_REPS}`,description:`You completed ${last.reps} reps. Consider +${round1(step)} kg if those reps were comfortable.`};
  return {kind:'hold',weight:last.weight,reps:TARGET_REPS,title:`Repeat ${round1(last.weight)} kg`,description:`Aim for ${TARGET_REPS} controlled reps. Maintain or reduce if form drops.`};
}
