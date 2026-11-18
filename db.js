// Setwise persistent workout storage. IndexedDB survives app code updates on the same origin.
// Do not rename DB_NAME or the object store without an explicit migration.
export const DB_NAME = 'setwise-workouts';
const DB_VERSION = 1;
const STORE = 'documents';
const KEY = 'main';
export const DATA_SCHEMA_VERSION = 1;

export const GROUPS = ['Chest','Back','Shoulders','Arms','Legs','Core','Full Body'];

const EXERCISE_SEEDS = {
  'Chest': ['Chest Press Machine','Incline Chest Press','Pec Deck','Cable Chest Fly','Bench Press','Incline Dumbbell Press'],
  'Back': ['Lat Pulldown','Seated Cable Row','Chest Supported Row','Assisted Pull-Up','Straight Arm Pulldown','Single Arm Dumbbell Row'],
  'Shoulders': ['Shoulder Press Machine','Dumbbell Shoulder Press','Lateral Raise Machine','Cable Lateral Raise','Reverse Pec Deck'],
  'Arms': ['Bicep Curl Machine','Dumbbell Bicep Curl','Cable Bicep Curl','Tricep Pushdown','Overhead Tricep Extension','Preacher Curl'],
  'Legs': ['Leg Press','Hack Squat','Leg Extension','Seated Leg Curl','Lying Leg Curl','Smith Machine Squat','Calf Raise Machine'],
  'Core': ['Abdominal Crunch Machine','Cable Crunch','Weighted Sit-Up','Hanging Knee Raise'],
  'Full Body': ['Deadlift','Dumbbell Squat','Kettlebell Swing']
};

export function makeId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function defaultData() {
  let order = 0;
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    exercises: Object.entries(EXERCISE_SEEDS).flatMap(([bodyPart,names]) => names.map(name => ({
      id: makeId(), name, bodyPart, targetSets: 3, archived: false, order: order++, equipment: 'auto'
    }))),
    sessions: [],
    settings: { incrementKg: 2.5, lastBackupAt: null, bodyweightKg: null }
  };
}

function connect() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('The workout database is open in another tab. Close it and retry.'));
  });
}

async function readStore(mode, run) {
  const db = await connect();
  try {
    return await new Promise((resolve,reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error ?? new Error('Database operation failed'));
      tx.onabort = () => reject(tx.error ?? new Error('Database operation aborted'));
    });
  } finally { db.close(); }
}

export async function loadData() {
  const saved = await readStore('readonly', store => store.get(KEY));
  if (saved) return validateData(saved);
  const fresh = defaultData();
  await writeData(fresh);
  return fresh;
}

export async function writeData(data) {
  const clean = validateData(data);
  await readStore('readwrite', store => store.put(clean, KEY));
  return clean;
}

function finiteNumber(x) { return typeof x === 'number' && Number.isFinite(x); }
function safeDate(x) { return typeof x === 'string' && x.length > 0 && Number.isFinite(Date.parse(x)); }

export function validateData(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || candidate.schemaVersion !== DATA_SCHEMA_VERSION || !Array.isArray(candidate.exercises) || !Array.isArray(candidate.sessions)) {
    throw new Error('Unsupported backup format or database version. Your current data has not been changed.');
  }
  if (candidate.exercises.length > 2500 || candidate.sessions.length > 50000) throw new Error('Backup exceeds reasonable size limits.');
  const exerciseIds = new Set();
  for (const e of candidate.exercises) {
    if (!e || typeof e.id !== 'string' || !e.id || exerciseIds.has(e.id) || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 160 || !GROUPS.includes(e.bodyPart) || !Number.isInteger(e.targetSets) || e.targetSets < 1 || e.targetSets > 20 || typeof e.archived !== 'boolean') {
      throw new Error('Backup contains an invalid exercise. Nothing was changed.');
    }
    if(e.equipment != null && !['auto','machine','barbell','dumbbell','bodyweight','other'].includes(e.equipment)) throw new Error('Backup contains an invalid equipment type.');
    exerciseIds.add(e.id);
  }
  const sessionIds = new Set();
  for (const s of candidate.sessions) {
    if (!s || typeof s.id !== 'string' || !s.id || sessionIds.has(s.id) || !GROUPS.includes(s.bodyPart) || !safeDate(s.startedAt) || (s.endedAt != null && !safeDate(s.endedAt)) || !Array.isArray(s.sets) || s.sets.length > 1000) {
      throw new Error('Backup contains an invalid workout. Nothing was changed.');
    }
    sessionIds.add(s.id);
    const setIds = new Set();
    for (const t of s.sets) {
      if (!t || typeof t.id !== 'string' || !t.id || setIds.has(t.id) || !exerciseIds.has(t.exerciseId) || !Number.isInteger(t.setNumber) || t.setNumber < 1 || t.setNumber > 1000 || !finiteNumber(t.weight) || t.weight < 0 || t.weight > 10000 || !Number.isInteger(t.reps) || t.reps < 1 || t.reps > 10000 || !safeDate(t.createdAt)) {
        throw new Error('Backup contains an invalid set. Nothing was changed.');
      }
      if(t.kind!=null && !['working','warmup'].includes(t.kind))throw new Error('Backup contains an invalid set type.');
      if(t.rir!=null && (!Number.isInteger(t.rir)||t.rir<0||t.rir>4))throw new Error('Backup contains an invalid effort rating.');
      setIds.add(t.id);
    }
  }
  if (candidate.sessions.filter(s=>!s.endedAt).length > 1) throw new Error('Backup contains multiple active sessions. Nothing was changed.');
  const settings = candidate.settings || {};
  const incrementKg = finiteNumber(settings.incrementKg) && settings.incrementKg > 0 && settings.incrementKg <= 100 ? settings.incrementKg : 2.5;
  const lastBackupAt = settings.lastBackupAt == null || safeDate(settings.lastBackupAt) ? (settings.lastBackupAt ?? null) : null;
  const bodyweightKg = settings.bodyweightKg == null ? null : (finiteNumber(settings.bodyweightKg) && settings.bodyweightKg >= 20 && settings.bodyweightKg <= 400 ? settings.bodyweightKg : null);
  // Preserve known document fields only. Unknown future schema versions must be explicitly migrated.
  return { schemaVersion: DATA_SCHEMA_VERSION,
    exercises: candidate.exercises.map(e=>({id:e.id,name:e.name.trim(),bodyPart:e.bodyPart,targetSets:e.targetSets,archived:e.archived,order:finiteNumber(e.order)?e.order:0,equipment:e.equipment??'auto'})),
    sessions: candidate.sessions.map(s=>({id:s.id,bodyPart:s.bodyPart,startedAt:s.startedAt,endedAt:s.endedAt ?? null,
      sets:s.sets.map(t=>({id:t.id,exerciseId:t.exerciseId,setNumber:t.setNumber,weight:t.weight,reps:t.reps,createdAt:t.createdAt,kind:t.kind??'working',rir:t.rir??null}))})),
    settings: {incrementKg,lastBackupAt,bodyweightKg}
  };
}
