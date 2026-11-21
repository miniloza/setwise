// Order workouts by the average logged exercise position in completed primary-group sessions.
export function averageExercisePositions(sessions, primaryGroup, maxSessions=16) {
  const completed = (sessions || []).filter(s=>s.endedAt && s.bodyPart===primaryGroup && s.sets?.length)
    .sort((a,b)=>Date.parse(b.endedAt)-Date.parse(a.endedAt)).slice(0,maxSessions);
  const totals = new Map();
  for (const session of completed) {
    const firstSeen = new Map();
    (session.sets||[]).forEach((set,index)=>{
      if (!firstSeen.has(set.exerciseId)) firstSeen.set(set.exerciseId,{stamp:Date.parse(set.createdAt)||0,index});
    });
    const exerciseOrder = [...firstSeen.entries()].sort((a,b)=>a[1].stamp-b[1].stamp || a[1].index-b[1].index);
    exerciseOrder.forEach(([id],index)=>{
      const old = totals.get(id) || {sum:0,count:0};
      old.sum += index+1; old.count++;
      totals.set(id,old);
    });
  }
  return new Map([...totals].map(([id,t])=>[id,t.sum/t.count]));
}

export function orderSessionExercises(exercises, session, completedSessions, primaryGroup) {
  const positions = averageExercisePositions(completedSessions,primaryGroup);
  const finished = new Set((session?.sets || []).map(t=>t.exerciseId));
  return [...exercises].sort((a,b)=>{
    // Exercises already logged today are still accessible, but shift below unused ones.
    const done = Number(finished.has(a.id)) - Number(finished.has(b.id));
    if (done) return done;
    const pa = positions.get(a.id), pb = positions.get(b.id);
    if (pa != null && pb != null && pa!==pb) return pa-pb;
    if (pa != null && pb == null) return -1;
    if (pb != null && pa == null) return 1;
    return (a.order??9999)-(b.order??9999) || a.name.localeCompare(b.name);
  });
}
