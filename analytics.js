// Pure analytics functions: never mutate original workout records.
export const isWorking = set => set && set.kind !== 'warmup'; // v1.0 sets are working by default
export const workingSets = (session, id) => (session?.sets || []).filter(t=>t.exerciseId===id && isWorking(t));
export const topSet = (session, id) => workingSets(session,id).filter(t=>t.weight>0 && t.reps>=1 && t.reps<=10 && (t.rir==null || t.rir<=2)).sort((a,b)=>estimate6(b)-estimate6(a))[0]||null;
export function estimate1(set) {return set && set.weight>0 && set.reps>=1 && set.reps<=10 ? set.weight*(1+set.reps/30) : null;}
export function estimate6(set) {const one=estimate1(set);return one==null?null:one/1.2;}
export function exerciseHistory(sessions,id) {
  return sessions.filter(s=>s.endedAt && workingSets(s,id).length).sort((a,b)=>Date.parse(a.endedAt)-Date.parse(b.endedAt));
}
export function sessionAnalysis(session,id) {
  const sets=workingSets(session,id),top=topSet(session,id);
  const volume=sets.reduce((v,t)=>v+t.weight*t.reps,0);
  const reps=sets.reduce((v,t)=>v+t.reps,0);
  return {session,sets,top,volume,reps,avgVolume:sets.length?volume/sets.length:null, six:top?estimate6(top):null,one:top?estimate1(top):null};
}
export function exerciseAnalytics(sessions,id) {
  const points=exerciseHistory(sessions,id).map(s=>sessionAnalysis(s,id));
  const valid=points.filter(p=>p.six!=null),latest=points.at(-1)||null;
  const strongest=valid.reduce((b,p)=>!b||p.six>b.six?p:b,null);
  const trend=valid.length>=2?(valid.at(-1).six/valid[0].six-1)*100:null;
  const avgVolume=points.length ? points.slice(-5).reduce((v,p)=>v+p.volume,0)/Math.min(5,points.length):null;
  return {points,latest,strongest,trend,avgVolume,validCount:valid.length};
}
export function bodyweightRelative(estimated1RM,bodyweightKg) {
 return Number.isFinite(estimated1RM)&&estimated1RM>0 && Number.isFinite(bodyweightKg) && bodyweightKg>0?estimated1RM/bodyweightKg:null;
}
export function exerciseType(exercise) {
 if(['machine','barbell','dumbbell','bodyweight','other'].includes(exercise?.equipment))return exercise.equipment;
 const n=(exercise?.name||'').toLowerCase();
 if(/barbell|bench press$|deadlift$|squat$/.test(n)&&!/machine|smith|hack|dumbbell/.test(n))return 'barbell';
 if(/dumbbell|kettlebell/.test(n))return 'dumbbell';
 if(/pull-up|push-up|hanging knee/.test(n))return 'bodyweight';
 return 'machine';
}
export function warmupPlan(load,step=2.5) {
 if(!Number.isFinite(load)||load<=0)return [];
 const round=(n)=>Math.max(step,Math.round(n/step)*step);
 return [{kind:'warmup',weight:round(load*.5),reps:8},{kind:'warmup',weight:round(load*.75),reps:4}]
 .filter(t=>t.weight < load);
}
export function progressionAdvice(sessions,id,step=2.5) {
 const pts=exerciseHistory(sessions,id).map(s=>sessionAnalysis(s,id));
 if(!pts.length)return {kind:'baseline',weight:null,title:'Find a comfortable working weight',details:'Aim for 6–10 controlled repetitions. Record effort to improve future suggestions.'};
 const last=pts.at(-1),first=last.sets[0];
 if(!first||first.weight<=0)return {kind:'baseline',weight:null,title:'Establish a weighted baseline',details:'A non-zero working load is needed to suggest progression.'};
 const recent=pts.slice(-2).map(p=>p.sets[0]);
 const ready=recent.length===2 && recent.every(t=>t.weight===first.weight&&t.reps>=10&&(t.rir==null||t.rir>=1)) && step>0 && step<=first.weight*.05;
 if(ready)return {kind:'increase',weight:Math.round((first.weight+step)*100)/100,title:`Consider ${Math.round((first.weight+step)*100)/100} kg × 6–8 reps`,details:'The first working set reached 10+ reps twice. Try a small increase only if technique, readiness and available machine increments allow.'};
 const next=Math.min(10,Math.max(6,first.reps+1));
 return {kind:'build',weight:first.weight,title:`Aim for ${first.weight} kg × ${next} reps`,details:'Maintain the current working load and build repetitions before increasing weight. Reduce it if technique deteriorates.'};
}
export function sameOrdinalAverage(sessions,id,ordinal,limit=5) {
 const points=exerciseHistory(sessions,id).slice(-limit).map(s=>workingSets(s,id)[ordinal-1]).filter(Boolean);
 if(!points.length)return null;
 return {weight:points.reduce((n,t)=>n+t.weight,0)/points.length,reps:points.reduce((n,t)=>n+t.reps,0)/points.length,count:points.length};
}
export function correspondingPrevious(sessions,id,ordinal) {
 const points=exerciseHistory(sessions,id);return points.length?workingSets(points.at(-1),id)[ordinal-1]||null:null;
}
