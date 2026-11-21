// Setwise's indicative eight-repetition target. Pure calculations: no storage changes.
// Epley estimate (assumes challenging full-range repetitions); partial reps are separate.
const TARGET_REPS = 8;
const MAX_HISTORY_SESSIONS = 8;

export function estimatedEightRepLoad(set) {
  if (!set || set.kind === 'warmup' || set.kind === 'drop' || !Number.isFinite(set.weight) || set.weight <= 0 ||
      !Number.isInteger(set.reps) || set.reps < 1 || set.reps > 15) return null;
  return set.weight * (1 + set.reps / 30) / (1 + TARGET_REPS / 30);
}

export function recommendEightRepTarget(completedSessions, exerciseId, currentSets = [], incrementKg = 2.5) {
  const step = Number.isFinite(incrementKg) && incrementKg > 0 && incrementKg <= 100 ? incrementKg : 2.5;
  const sessions = (completedSessions || [])
    .filter(s => s.endedAt && s.sets?.some(t => t.exerciseId === exerciseId && t.kind === 'working'))
    .sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt))
    .slice(0, MAX_HISTORY_SESSIONS);
  const refs = [
    ...sessions.flatMap(s => s.sets.filter(t => t.exerciseId === exerciseId && t.kind === 'working').map(t => ({...t, origin:'previous'}))),
    ...(currentSets || []).filter(t => t.exerciseId === exerciseId && t.kind === 'working').map(t => ({...t, origin:'today'}))
  ].map(set => ({set, estimate: estimatedEightRepLoad(set)})).filter(x => x.estimate != null);
  if (!refs.length) return {
    kind:'baseline', weight:null, reps:TARGET_REPS, optionalPartials:0,
    title:'Set your 8-rep baseline',
    description:'Choose a manageable working weight and record full repetitions to establish a target.'
  };
  refs.sort((a,b)=> b.estimate - a.estimate || (b.set.weight-a.set.weight));
  const reference = refs[0];
  const estimated = reference.estimate;
  const rounded = Math.floor((estimated + 1e-8) / step) * step;
  const targetWeight = Math.round(Math.max(step, rounded) * 100)/100;
  const latestWorking = (currentSets || []).filter(t=>t.exerciseId===exerciseId && t.kind==='working').at(-1);
  const optionalPartials = latestWorking?.partials >= 2 ? 2 : 0;
  const extra = optionalPartials ? ' + up to 2 half reps (optional)' : '';
  return {
    kind:'estimated',weight:targetWeight,reps:TARGET_REPS,optionalPartials,
    title:`Aim for ${targetWeight} kg × ${TARGET_REPS} reps${extra}`,
    description:`Epley 8RM ≈ ${Math.round(estimated*10)/10} kg from ${reference.set.origin==='today'?'today’s':'a previous'} ${reference.set.weight} kg × ${reference.set.reps} full reps. Adjust for fatigue and technique.`,
    source: {weight:reference.set.weight,reps:reference.set.reps,origin:reference.set.origin,estimatedEightRM:Math.round(estimated*10)/10}
  };
}
