/**
 * Web implementation — uses the remote Turso API with JWT auth.
 * Replaces the old localStorage-backed store.
 */
import { apiGet, apiPost, apiPut, apiDelete } from "../authStore";

// ─── PROFILE (local only on web — not synced to server) ─────────────────────
type Profile = { id: number; name: string; teamName: string; logoUrl?: string | null; createdAt: number };

function loadProfile(): Profile | null {
  try { const r = localStorage.getItem("cb_profile"); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveProfile(p: Profile) {
  try { localStorage.setItem("cb_profile", JSON.stringify(p)); } catch {}
}

export async function getProfile() { return loadProfile(); }
export async function upsertProfile(data: { name: string; teamName: string; logoUrl?: string | null }) {
  const existing = loadProfile();
  const p: Profile = { id: 1, ...data, createdAt: existing?.createdAt ?? Date.now() };
  saveProfile(p);
  return p;
}

// ─── PLAYERS ─────────────────────────────────────────────────────────────────
export async function getPlayers() {
  return apiGet("/players");
}
export async function getPlayer(id: string) {
  const players = await getPlayers();
  return players.find((p: any) => p.id === id) ?? null;
}
export async function createPlayer(data: any) {
  return apiPost("/players", data);
}
export async function updatePlayer(id: string, data: any) {
  await apiPut(`/players/${id}`, data);
  return { id, ...data };
}
export async function deletePlayer(id: string) {
  await apiDelete(`/players/${id}`);
}

// ─── EXERCISES ───────────────────────────────────────────────────────────────
export async function getExercises() {
  return apiGet("/exercises");
}
export async function getExercise(id: string) {
  const exercises = await getExercises();
  return exercises.find((e: any) => e.id === id) ?? null;
}
export async function createExercise(data: any) {
  return apiPost("/exercises", data);
}
export async function deleteExercise(id: string) {
  await apiDelete(`/exercises/${id}`);
}

// ─── SESSIONS ────────────────────────────────────────────────────────────────
export async function getSessions() {
  return apiGet("/sessions");
}
export async function getSession(id: string) {
  const sessions = await getSessions();
  return sessions.find((s: any) => s.id === id) ?? null;
}
export async function getSessionWithExercises(id: string) {
  return apiGet(`/sessions/${id}`);
}
export async function createSession(data: any) {
  return apiPost("/sessions", data);
}
export async function updateSession(id: string, data: any) {
  return apiPut(`/sessions/${id}`, data);
}
export async function deleteSession(id: string) {
  await apiDelete(`/sessions/${id}`);
}
export async function addExerciseToSession(sessionId: string, exerciseId: string, order: number, opts?: { customDuration?: number | null; notes?: string | null }) {
  return apiPost(`/sessions/${sessionId}/exercises`, {
    exerciseId,
    order,
    customDuration: opts?.customDuration ?? null,
    notes: opts?.notes ?? null,
  });
}
export async function removeExerciseFromSession(sessionId: string, exerciseId: string) {
  await apiDelete(`/sessions/${sessionId}/exercises/${exerciseId}`);
}

// ─── MATCHES ─────────────────────────────────────────────────────────────────
export async function getMatches() {
  return apiGet("/matches");
}
export async function getMatch(id: string) {
  return apiGet(`/matches/${id}`);
}
export async function createMatch(data: any) {
  return apiPost("/matches", data);
}
export async function updateMatch(id: string, data: any) {
  await apiPut(`/matches/${id}`, data);
}
export async function updateMatchSubstitutions(matchId: string, substitutions: any[]) {
  await apiPut(`/matches/${matchId}/substitutions`, { substitutions });
}
export async function updateMatchCards(matchId: string, cards: any[]) {
  await apiPut(`/matches/${matchId}/cards`, { cards });
}
export async function deleteMatch(id: string) {
  await apiDelete(`/matches/${id}`);
}

// ─── CONVOCATIONS ─────────────────────────────────────────────────────────────
export async function setConvocations(matchId: string, playerIds: { playerId: string; jerseyNumber?: number | null }[]) {
  await apiPut(`/matches/${matchId}/convocations`, {
    playerIds: playerIds.map(p => p.playerId),
    jerseyNumbers: Object.fromEntries(playerIds.map(p => [p.playerId, p.jerseyNumber?.toString() ?? ""])),
  });
}
export async function addConvocation(matchId: string, playerId: string, jerseyNumber?: number | null) {
  // Get current convocations and add this one
  const match = await getMatch(matchId);
  const existing = (match?.convocations ?? []).map((c: any) => ({ playerId: c.playerId, jerseyNumber: c.jerseyNumber }));
  if (existing.some((c: any) => c.playerId === playerId)) return;
  existing.push({ playerId, jerseyNumber: jerseyNumber ?? null });
  await setConvocations(matchId, existing);
}
export async function removeConvocation(matchId: string, playerId: string) {
  const match = await getMatch(matchId);
  const existing = (match?.convocations ?? [])
    .filter((c: any) => c.playerId !== playerId)
    .map((c: any) => ({ playerId: c.playerId, jerseyNumber: c.jerseyNumber }));
  await setConvocations(matchId, existing);
}

// ─── LINEUP ───────────────────────────────────────────────────────────────────
export async function setLineup(matchId: string, entries: any[]) {
  await apiPut(`/matches/${matchId}/lineup`, { players: entries });
}
export async function updateLineupPlayer(lineupId: string, data: any) {
  return apiPut(`/lineup/${lineupId}`, data);
}

// ─── GOALS ───────────────────────────────────────────────────────────────────
export async function addGoal(matchId: string, data: any) {
  const match = await getMatch(matchId);
  const existing = match?.goals ?? [];
  const newGoal = { ...data, id: Math.random().toString(36).slice(2) };
  existing.push(newGoal);
  await apiPut(`/matches/${matchId}/goals`, {
    goals: existing.map((g: any) => ({
      playerId: g.playerId ?? null,
      minute: g.minute ?? null,
      type: g.type ?? "goal",
      notes: g.notes ?? null,
    })),
    goalsFor: match?.goalsFor ?? null,
    goalsAgainst: match?.goalsAgainst ?? null,
  });
  return newGoal.id;
}
export async function removeGoal(goalId: string) {
  return apiDelete(`/goals/${goalId}`);
}

// ─── REPLACE ALL GOALS (atomic) ──────────────────────────────────────────────
export async function replaceGoals(
  matchId: string,
  goals: { playerId: string | null; minute: number | null; type: string; notes: string | null }[],
  goalsFor: number | null,
  goalsAgainst: number | null
) {
  return apiPut(`/matches/${matchId}/goals`, {
    goals,
    goalsFor,
    goalsAgainst,
  });
}

// ─── PLAYER STATS ─────────────────────────────────────────────────────────────
export async function computePlayerStats(playerId: string) {
  return apiGet(`/players/${playerId}/stats`);
}
