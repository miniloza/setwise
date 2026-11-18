export const isWarmup = set => set?.kind === 'warmup';
export const isDrop = set => set?.kind === 'drop';
export const isWorking = set => set && set.kind !== 'warmup';
export const isStrengthSet = set => set && set.kind === 'working';
export const workingSets = (session, id) => (session?.sets || []).filter(t => t.exerciseId === id && isWorking(t));
export const strengthSets = (session,id) => (session?.sets || []).filter(t => t.exerciseId===id && isStrengthSet(t));

export function estimate1(set) { return set && set.weight>0 && set.reps>=1 && set.reps<=10 ? set.weight*(1+set.reps/30) : null; }
export function estimate6(set) { const one = estimate1(set); return one == null ? null : one/1.2; }

export const topSet = (session, id) => strengthSets(session,id).filter(t => t.weight>0 && t.reps>=1 && t.reps<=10).sort((a,b) => (estimate6(b) ?? 0) - (estimate6(a) ?? 0))[0] || null;

export function exerciseHistory(sessions,id) {
  return sessions.filter(s => s.endedAt && strengthSets(s,id).length).sort((a,b) => Date.parse(a.endedAt) - Date.parse(b.endedAt));
}
export function allExerciseSessions(sessions,id) {
  return sessions.filter(s => s.endedAt && workingSets(s,id).length).sort((a,b) => Date.parse(a.endedAt) - Date.parse(b.endedAt));
}
export function sessionAnalysis(session,id) {
  const sets = workingSets(session,id);
  const qualifying = strengthSets(session,id);
  const top = topSet(session,id);
  const volume = sets.reduce((v,t)=>v+t.weight*t.reps,0);
  const reps = sets.reduce((v,t)=>v+t.reps,0);
  return {session,sets,qualifying,top,volume,reps,avgVolume:sets.length?volume/sets.length:null,six:top?estimate6(top):null,one:top?estimate1(top):null};
}
export function exerciseAnalytics(sessions,id) {
  const points = allExerciseSessions(sessions,id).map(s=>sessionAnalysis(s,id));
  const valid = points.filter(p=>p.six!=null), latest = points.at(-1) || null;
  const strongest = valid.reduce((b,p)=>!b||p.six>b.six?p:b,null);
  const trend = valid.length>=2 ? (valid.at(-1).six/valid[0].six-1)*100 : null;
  const avgVolume = points.length ? points.slice(-5).reduce((v,p)=>v+p.volume,0)/Math.min(5,points.length) : null;
  return {points,latest,strongest,trend,avgVolume,validCount:valid.length};
}
export function bodyweightRelative(estimated1RM,bodyweightKg) {
  return Number.isFinite(estimated1RM) && estimated1RM>0 && Number.isFinite(bodyweightKg) && bodyweightKg>0 ? estimated1RM/bodyweightKg : null;
}
export function exerciseType(exercise) {
  if(['machine','barbell','dumbbell','bodyweight','other'].includes(exercise?.equipment)) return exercise.equipment;
  const n=(exercise?.name||'').toLowerCase();
  if(/barbell|bench press$|deadlift$|squat$/.test(n) && !/machine|smith|hack|dumbbell/.test(n)) return 'barbell';
  if(/dumbbell|kettlebell/.test(n)) return 'dumbbell';
  if(/pull-up|push-up|hanging knee/.test(n)) return 'bodyweight';
  return 'machine';
}
export function warmupPlan(load,step=2.5) {
  if(!Number.isFinite(load)||load<=0) return [];
  const round = n => Math.max(step, Math.round(n/step)*step);
  return [{kind:'warmup',weight:round(load*.5),reps:8},{kind:'warmup',weight:round(load*.75),reps:4}].filter(t=>t.weight < load);
}
export function progressionAdvice(sessions,id,step=2.5) {
  const pts = exerciseHistory(sessions,id).map(s=>sessionAnalysis(s,id));
  if(!pts.length) return {kind:'baseline',weight:null,title:'Find a comfortable working weight',details:'Aim for 6–10 controlled repetitions. Use half reps only as an effort note, not as full reps.'};
  const firstSet = pts.at(-1)?.qualifying?.[0];
  if(!firstSet || firstSet.weight<=0) return {kind:'baseline',weight:null,title:'Establish a weighted baseline',details:'A non-zero working load is needed to suggest progression.'};
  const recentFirsts = pts.slice(-2).map(p=>p.qualifying[0]).filter(Boolean);
  const ready = recentFirsts.length===2 && recentFirsts.every(t=>t.weight===firstSet.weight && t.reps>=10) && step>0 && step<=firstSet.weight*.08;
  if(ready) return {kind:'increase',weight:Math.round((firstSet.weight+step)*100)/100,title:`Consider ${Math.round((firstSet.weight+step)*100)/100} kg × 6–8 reps`,details:'You have reached the top of the rep range in two recent sessions. A small increase is reasonable if form stays strong.'};
  const next = Math.min(10,Math.max(6,firstSet.reps+1));
  return {kind:'build',weight:firstSet.weight,title:`Aim for ${firstSet.weight} kg × ${next} reps`,details:'Keep the current working load and build repetitions before increasing weight.'};
}
export function sameOrdinalAverage(sessions,id,ordinal,limit=5) {
  const points = exerciseHistory(sessions,id).slice(-limit).map(s=>strengthSets(s,id)[ordinal-1]).filter(Boolean);
  if(!points.length) return null;
  return {weight:points.reduce((n,t)=>n+t.weight,0)/points.length,reps:points.reduce((n,t)=>n+t.reps,0)/points.length,count:points.length};
}
export function correspondingPrevious(sessions,id,ordinal) {
  const points=exerciseHistory(sessions,id); return points.length ? strengthSets(points.at(-1),id)[ordinal-1] || null : null;
}
export function bodyweightForDate(history, isoDate, current = null) {
  const list = (history || []).filter(r => r && Number.isFinite(r.kg) && r.recordedAt).sort((a,b)=>Date.parse(a.recordedAt)-Date.parse(b.recordedAt));
  const at = Date.parse(isoDate);
  let chosen = null;
  for (const record of list) if (Date.parse(record.recordedAt) <= at) chosen = record; else break;
  return chosen?.kg ?? current ?? null;
}
export function bodyPartSummary(sessions, exercises, bodyPart) {
  const scoped = exercises.filter(e => e.bodyPart === bodyPart);
  const summaries = scoped.map(ex => ({ exercise: ex, analytics: exerciseAnalytics(sessions, ex.id) })).filter(x => x.analytics.points.length);
  const totalVolume = summaries.reduce((n,x) => n + (x.analytics.latest?.volume ?? 0), 0);
  const strongest = summaries.reduce((best,x) => (!best || (x.analytics.strongest?.six ?? 0) > (best.analytics.strongest?.six ?? 0)) ? x : best, null);
  return { summaries, totalVolume, strongest, trackedExercises: summaries.length };
}
