/**
 * Web implementation — localStorage-backed in-memory store.
 * Funziona su browser (preview Runable) senza SQLite.
 */
import { getDefaultExercises, uid } from "./exercises-data";

// ─── LocalStorage persistence ─────────────────────────────────────────────────
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem("cb_" + key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}
function save(key: string, value: any) {
  try { localStorage.setItem("cb_" + key, JSON.stringify(value)); } catch {}
}

// ─── In-memory store ──────────────────────────────────────────────────────────
type Player = {
  id: string; name: string; number?: number | null; role: string;
  subRole?: string | null; secondaryRole?: string | null; secondarySubRole?: string | null;
  dateOfBirth?: string | null; foot?: string | null; photoUrl?: string | null;
  notes?: string | null; createdAt: number;
};
type Exercise = {
  id: string; name: string; nameEn?: string | null; category: string;
  description: string; descriptionEn?: string | null; duration: number;
  players?: number | null; intensity: string; materials?: string | null;
  primaryObjective?: string | null; secondaryObjectives?: string | null;
  isCustom: boolean; createdAt: number;
};
type Session = {
  id: string; title: string; date: string; duration?: number | null;
  notes?: string | null; createdAt: number;
};
type SessionExercise = {
  id: string; sessionId: string; exerciseId: string; order: number;
  customDuration?: number | null; notes?: string | null;
};
type Match = {
  id: string; opponent: string; date: string; time?: string | null;
  venue?: string | null; homeAway: string; competition?: string | null;
  formation?: string | null; notes?: string | null;
  goalsFor?: number | null; goalsAgainst?: number | null;
  substitutions?: string | null; cards?: string | null; createdAt: number;
};
type Convocation = { id: string; matchId: string; playerId: string; jerseyNumber?: number | null };
type LineupEntry = {
  id: string; matchId: string; playerId: string; order: number;
  positionRole?: string | null; jerseyNumber?: number | null;
  isCaptain?: boolean; isViceCaptain?: boolean;
  isFreekickTaker?: boolean; isCornerTaker?: boolean;
  isPenaltyTaker?: boolean; isWallPlayer?: boolean;
  posX?: number | null; posY?: number | null;
};
type Goal = {
  id: string; matchId: string; playerId?: string | null;
  minute?: number | null; type: string; notes?: string | null;
};
type Profile = { id: number; name: string; teamName: string; logoUrl?: string | null; createdAt: number };

// Inizializza store da localStorage
const _defaultExercises = getDefaultExercises(Date.now());

const store = {
  profile: load<Profile | null>("profile", null),
  players: load<Player[]>("players", []),
  exercises: load<Exercise[]>("exercises", _defaultExercises as Exercise[]),
  sessions: load<Session[]>("sessions", []),
  sessionExercises: load<SessionExercise[]>("sessionExercises", []),
  matches: load<Match[]>("matches", []),
  convocations: load<Convocation[]>("convocations", []),
  lineup: load<LineupEntry[]>("lineup", []),
  goals: load<Goal[]>("goals", []),
};

// Se gli esercizi sono vuoti (primo avvio), seediamo i default
if (store.exercises.length === 0) {
  store.exercises = _defaultExercises as Exercise[];
  save("exercises", store.exercises);
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
export async function getProfile() { return store.profile; }
export async function upsertProfile(data: { name: string; teamName: string; logoUrl?: string | null }) {
  store.profile = { id: 1, ...data, createdAt: store.profile?.createdAt ?? Date.now() };
  save("profile", store.profile);
  return store.profile;
}

// ─── PLAYERS ─────────────────────────────────────────────────────────────────
export async function getPlayers() {
  return [...store.players].sort((a, b) => a.createdAt - b.createdAt);
}
export async function getPlayer(id: string) {
  return store.players.find(p => p.id === id) ?? null;
}
export async function createPlayer(data: Omit<Player, "id" | "createdAt">) {
  const p: Player = { id: uid(), ...data, createdAt: Date.now() };
  store.players.push(p);
  save("players", store.players);
  return p;
}
export async function updatePlayer(id: string, data: Partial<Player>) {
  const i = store.players.findIndex(p => p.id === id);
  if (i >= 0) { store.players[i] = { ...store.players[i], ...data }; save("players", store.players); }
  return store.players[i] ?? null;
}
export async function deletePlayer(id: string) {
  store.players = store.players.filter(p => p.id !== id);
  save("players", store.players);
}

// ─── EXERCISES ───────────────────────────────────────────────────────────────
export async function getExercises() {
  return [...store.exercises].sort((a, b) => {
    const cc = a.category.localeCompare(b.category);
    return cc !== 0 ? cc : a.name.localeCompare(b.name);
  });
}
export async function getExercise(id: string) {
  return store.exercises.find(e => e.id === id) ?? null;
}
export async function createExercise(data: Omit<Exercise, "id" | "createdAt" | "isCustom">) {
  const e: Exercise = { id: uid(), ...data, isCustom: true, createdAt: Date.now() };
  store.exercises.push(e);
  save("exercises", store.exercises);
  return e;
}
export async function deleteExercise(id: string) {
  store.exercises = store.exercises.filter(e => e.id !== id);
  save("exercises", store.exercises);
}

// ─── SESSIONS ────────────────────────────────────────────────────────────────
export async function getSessions() {
  return [...store.sessions].sort((a, b) => b.date.localeCompare(a.date));
}
export async function getSession(id: string) {
  return store.sessions.find(s => s.id === id) ?? null;
}
export async function getSessionWithExercises(id: string) {
  const session = store.sessions.find(s => s.id === id);
  if (!session) return null;
  const seRows = store.sessionExercises
    .filter(se => se.sessionId === id)
    .sort((a, b) => a.order - b.order);
  const items = seRows.map(se => ({
    ...se,
    exercise: store.exercises.find(e => e.id === se.exerciseId) ?? null,
  }));
  return { ...session, exercises: items };
}
export async function createSession(data: Omit<Session, "id" | "createdAt">) {
  const s: Session = { id: uid(), ...data, createdAt: Date.now() };
  store.sessions.push(s);
  save("sessions", store.sessions);
  return s;
}
export async function updateSession(id: string, data: Partial<Session>) {
  const i = store.sessions.findIndex(s => s.id === id);
  if (i >= 0) { store.sessions[i] = { ...store.sessions[i], ...data }; save("sessions", store.sessions); }
  return store.sessions[i] ?? null;
}
export async function deleteSession(id: string) {
  store.sessionExercises = store.sessionExercises.filter(se => se.sessionId !== id);
  store.sessions = store.sessions.filter(s => s.id !== id);
  save("sessions", store.sessions);
  save("sessionExercises", store.sessionExercises);
}
export async function addExerciseToSession(sessionId: string, exerciseId: string, order: number, opts?: { customDuration?: number | null; notes?: string | null }) {
  const id = uid();
  store.sessionExercises.push({ id, sessionId, exerciseId, order, ...opts });
  save("sessionExercises", store.sessionExercises);
  return id;
}
export async function removeExerciseFromSession(id: string) {
  store.sessionExercises = store.sessionExercises.filter(se => se.id !== id);
  save("sessionExercises", store.sessionExercises);
}

// ─── MATCHES ─────────────────────────────────────────────────────────────────
function parseJSON<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}
function formatMatch(m: Match) {
  return { ...m, substitutions: parseJSON<any[]>(m.substitutions, []), cards: parseJSON<any[]>(m.cards, []) };
}

export async function getMatches() {
  return [...store.matches]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(formatMatch);
}
export async function getMatch(id: string) {
  const m = store.matches.find(m => m.id === id);
  if (!m) return null;
  const fm = formatMatch(m);
  const convRows = store.convocations.filter(c => c.matchId === id);
  const convocations = convRows.map(c => ({
    ...c,
    player: store.players.find(p => p.id === c.playerId) ?? null,
  }));
  const lineupRows = store.lineup
    .filter(l => l.matchId === id)
    .sort((a, b) => a.order - b.order);
  const lineup = lineupRows.map(l => ({
    isCaptain: false, isViceCaptain: false,
    isFreekickTaker: false, isCornerTaker: false,
    isPenaltyTaker: false, isWallPlayer: false,
    ...l,
    player: store.players.find(p => p.id === l.playerId) ?? null,
  }));
  const goalRows = store.goals.filter(g => g.matchId === id);
  const goals = goalRows.map(g => ({
    ...g,
    player: g.playerId ? (store.players.find(p => p.id === g.playerId) ?? null) : null,
  }));
  return { ...fm, convocations, lineup, goals };
}
export async function createMatch(data: Omit<Match, "id" | "createdAt"> & { homeAway?: string }) {
  const m: Match = { id: uid(), homeAway: "home", ...data, createdAt: Date.now() };
  store.matches.push(m);
  save("matches", store.matches);
  return getMatch(m.id);
}
export async function updateMatch(id: string, data: Partial<Match>) {
  const i = store.matches.findIndex(m => m.id === id);
  if (i >= 0) { store.matches[i] = { ...store.matches[i], ...data }; save("matches", store.matches); }
}
export async function deleteMatch(id: string) {
  store.convocations = store.convocations.filter(c => c.matchId !== id);
  store.lineup = store.lineup.filter(l => l.matchId !== id);
  store.goals = store.goals.filter(g => g.matchId !== id);
  store.matches = store.matches.filter(m => m.id !== id);
  save("matches", store.matches);
  save("convocations", store.convocations);
  save("lineup", store.lineup);
  save("goals", store.goals);
}

// ─── CONVOCATIONS ─────────────────────────────────────────────────────────────
export async function setConvocations(matchId: string, playerIds: { playerId: string; jerseyNumber?: number | null }[]) {
  store.convocations = store.convocations.filter(c => c.matchId !== matchId);
  for (const p of playerIds) {
    store.convocations.push({ id: uid(), matchId, playerId: p.playerId, jerseyNumber: p.jerseyNumber ?? null });
  }
  save("convocations", store.convocations);
}
export async function addConvocation(matchId: string, playerId: string, jerseyNumber?: number | null) {
  if (store.convocations.some(c => c.matchId === matchId && c.playerId === playerId)) return;
  store.convocations.push({ id: uid(), matchId, playerId, jerseyNumber: jerseyNumber ?? null });
  save("convocations", store.convocations);
}
export async function removeConvocation(matchId: string, playerId: string) {
  store.convocations = store.convocations.filter(c => !(c.matchId === matchId && c.playerId === playerId));
  save("convocations", store.convocations);
}

// ─── LINEUP ───────────────────────────────────────────────────────────────────
export async function setLineup(matchId: string, entries: Omit<LineupEntry, "id" | "matchId">[]) {
  store.lineup = store.lineup.filter(l => l.matchId !== matchId);
  entries.forEach((e, i) => {
    store.lineup.push({
      isCaptain: false, isViceCaptain: false,
      isFreekickTaker: false, isCornerTaker: false,
      isPenaltyTaker: false, isWallPlayer: false,
      ...e,
      id: uid(), matchId, order: e.order ?? i,
    });
  });
  save("lineup", store.lineup);
}
export async function updateLineupPlayer(lineupId: string, data: Partial<LineupEntry>) {
  const i = store.lineup.findIndex(l => l.id === lineupId);
  if (i >= 0) { store.lineup[i] = { ...store.lineup[i], ...data }; save("lineup", store.lineup); }
}

// ─── GOALS ───────────────────────────────────────────────────────────────────
export async function addGoal(matchId: string, data: { playerId?: string | null; minute?: number | null; type?: string; notes?: string | null }) {
  const id = uid();
  store.goals.push({ id, matchId, type: data.type ?? "goal", ...data });
  save("goals", store.goals);
  return id;
}
export async function removeGoal(goalId: string) {
  store.goals = store.goals.filter(g => g.id !== goalId);
  save("goals", store.goals);
}

// ─── PLAYER STATS ─────────────────────────────────────────────────────────────
export async function computePlayerStats(playerId: string) {
  const allMatches = [...store.matches].sort((a, b) => b.date.localeCompare(a.date));
  let convocazioni = 0, titolare = 0, presenze = 0;
  let goalsScored = 0, yellowCards = 0, redCards = 0;
  let wins = 0, draws = 0, losses = 0;
  const matchHistory: any[] = [];

  for (const match of allMatches) {
    const convRows = store.convocations.filter(c => c.matchId === match.id);
    const lineupRows = store.lineup.filter(l => l.matchId === match.id);
    const goalRows = store.goals.filter(g => g.matchId === match.id);
    const subs = parseJSON<any[]>(match.substitutions, []);
    const cards = parseJSON<any[]>(match.cards, []);

    const inLineup = lineupRows.some(l => l.playerId === playerId);
    const inConvocations = convRows.some(c => c.playerId === playerId);
    const subIn = subs.find((s: any) => s.playerInId === playerId);

    if (!inLineup && !inConvocations && !subIn) continue;
    if (inConvocations || inLineup) convocazioni++;

    let role: "titolare" | "subentrato" | "panchina" | null = null;
    if (inLineup) { role = "titolare"; titolare++; presenze++; }
    else if (subIn) { role = "subentrato"; presenze++; }
    else if (inConvocations) { role = "panchina"; }

    let matchGoalCount = 0;
    for (const g of goalRows) {
      if (g.playerId === playerId && g.type !== "autogoal") { goalsScored++; matchGoalCount++; }
    }
    let matchYellow = false, matchRed = false;
    for (const card of cards) {
      if (card.playerId === playerId) {
        if (card.type === "yellow") { yellowCards++; matchYellow = true; }
        else if (card.type === "red") { redCards++; matchRed = true; }
      }
    }
    if ((role === "titolare" || role === "subentrato") && match.goalsFor != null && match.goalsAgainst != null) {
      if (match.goalsFor > match.goalsAgainst) wins++;
      else if (match.goalsFor === match.goalsAgainst) draws++;
      else losses++;
    }
    matchHistory.push({
      matchId: match.id, opponent: match.opponent, date: match.date,
      competition: match.competition ?? null, role,
      goalsFor: match.goalsFor ?? null, goalsAgainst: match.goalsAgainst ?? null,
      yellowCard: matchYellow, redCard: matchRed, goalsScored: matchGoalCount,
    });
  }
  matchHistory.sort((a, b) => b.date.localeCompare(a.date));
  return { convocazioni, titolare, presenze, goalsScored, yellowCards, redCards, wins, draws, losses, matchHistory };
}
