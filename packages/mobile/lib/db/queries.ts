/**
 * All local DB queries — replaces remote API calls.
 * Every function returns plain JS objects matching the same shape the screens expected.
 */
import { db } from "./client";
import {
  players, exercises, sessions, sessionExercises,
  matches, matchConvocations, matchLineup, matchGoals, profile,
} from "./schema";
import { eq, asc, desc } from "drizzle-orm";

function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────
export async function getProfile() {
  const rows = await db.select().from(profile).where(eq(profile.id, 1));
  return rows[0] ?? null;
}

export async function upsertProfile(data: { name: string; teamName: string; logoUrl?: string | null }) {
  const existing = await getProfile();
  if (existing) {
    await db.update(profile).set({ ...data }).where(eq(profile.id, 1));
  } else {
    await db.insert(profile).values({ id: 1, ...data, createdAt: Date.now() });
  }
  return getProfile();
}

// ─── PLAYERS ─────────────────────────────────────────────────────────────────
export async function getPlayers() {
  return db.select().from(players).orderBy(asc(players.createdAt));
}

export async function getPlayer(id: string) {
  const rows = await db.select().from(players).where(eq(players.id, id));
  return rows[0] ?? null;
}

export async function createPlayer(data: {
  name: string; role: string; number?: number | null;
  subRole?: string | null; secondaryRole?: string | null; secondarySubRole?: string | null;
  dateOfBirth?: string | null; foot?: string | null; photoUrl?: string | null; notes?: string | null;
}) {
  const id = uid();
  await db.insert(players).values({ id, ...data, createdAt: Date.now() });
  return getPlayer(id);
}

export async function updatePlayer(id: string, data: Partial<{
  name: string; role: string; number: number | null;
  subRole: string | null; secondaryRole: string | null; secondarySubRole: string | null;
  dateOfBirth: string | null; foot: string | null; photoUrl: string | null; notes: string | null;
}>) {
  await db.update(players).set(data).where(eq(players.id, id));
  return getPlayer(id);
}

export async function deletePlayer(id: string) {
  await db.delete(players).where(eq(players.id, id));
}

// ─── EXERCISES ───────────────────────────────────────────────────────────────
export async function getExercises() {
  return db.select().from(exercises).orderBy(asc(exercises.category), asc(exercises.name));
}

export async function getExercise(id: string) {
  const rows = await db.select().from(exercises).where(eq(exercises.id, id));
  return rows[0] ?? null;
}

export async function createExercise(data: {
  name: string; nameEn?: string | null; category: string; description: string;
  descriptionEn?: string | null; duration: number; players?: number | null;
  intensity: string; materials?: string | null; primaryObjective?: string | null;
  secondaryObjectives?: string | null; isCustom?: boolean; diagramImage?: string | null;
}) {
  const id = uid();
  await db.insert(exercises).values({ id, ...data, isCustom: true, createdAt: Date.now() });
  return getExercise(id);
}

export async function deleteExercise(id: string) {
  await db.delete(exercises).where(eq(exercises.id, id));
}

// ─── SESSIONS ────────────────────────────────────────────────────────────────
export async function getSessions() {
  return db.select().from(sessions).orderBy(desc(sessions.date));
}

export async function getSession(id: string) {
  const rows = await db.select().from(sessions).where(eq(sessions.id, id));
  return rows[0] ?? null;
}

export async function getSessionWithExercises(id: string) {
  const session = await getSession(id);
  if (!session) return null;
  const seRows = await db.select().from(sessionExercises)
    .where(eq(sessionExercises.sessionId, id))
    .orderBy(asc(sessionExercises.order));
  // Fetch exercise details for each
  const items = await Promise.all(seRows.map(async se => {
    const ex = await getExercise(se.exerciseId);
    return { ...se, exercise: ex };
  }));
  return { ...session, exercises: items };
}

export async function createSession(data: {
  title: string; date: string; duration?: number | null; notes?: string | null;
}) {
  const id = uid();
  await db.insert(sessions).values({ id, ...data, createdAt: Date.now() });
  return getSession(id);
}

export async function updateSession(id: string, data: Partial<{
  title: string; date: string; duration: number | null; notes: string | null;
}>) {
  await db.update(sessions).set(data).where(eq(sessions.id, id));
  return getSession(id);
}

export async function deleteSession(id: string) {
  await db.delete(sessionExercises).where(eq(sessionExercises.sessionId, id));
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function addExerciseToSession(sessionId: string, exerciseId: string, order: number, opts?: { customDuration?: number | null; notes?: string | null }) {
  const id = uid();
  await db.insert(sessionExercises).values({ id, sessionId, exerciseId, order, ...opts });
  return id;
}

export async function removeExerciseFromSession(sessionExerciseId: string) {
  await db.delete(sessionExercises).where(eq(sessionExercises.id, sessionExerciseId));
}

// ─── MATCHES ─────────────────────────────────────────────────────────────────
function parseJSON<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

function formatMatch(m: typeof matches.$inferSelect) {
  return {
    ...m,
    substitutions: parseJSON<any[]>(m.substitutions, []),
    cards: parseJSON<any[]>(m.cards, []),
  };
}

export async function getMatches() {
  const rows = await db.select().from(matches).orderBy(desc(matches.date));
  return rows.map(formatMatch);
}

export async function getMatch(id: string) {
  const rows = await db.select().from(matches).where(eq(matches.id, id));
  if (!rows[0]) return null;
  const m = formatMatch(rows[0]);

  // Convocations
  const convRows = await db.select().from(matchConvocations).where(eq(matchConvocations.matchId, id));
  const convocations = await Promise.all(convRows.map(async c => {
    const p = await getPlayer(c.playerId);
    return { ...c, player: p };
  }));

  // Lineup
  const lineupRows = await db.select().from(matchLineup)
    .where(eq(matchLineup.matchId, id))
    .orderBy(asc(matchLineup.order));
  const lineup = await Promise.all(lineupRows.map(async l => {
    const p = await getPlayer(l.playerId);
    return { ...l, player: p };
  }));

  // Goals
  const goalRows = await db.select().from(matchGoals).where(eq(matchGoals.matchId, id));
  const goals = await Promise.all(goalRows.map(async g => {
    const p = g.playerId ? await getPlayer(g.playerId) : null;
    return { ...g, player: p };
  }));

  return { ...m, convocations, lineup, goals };
}

export async function createMatch(data: {
  opponent: string; date: string; time?: string | null; venue?: string | null;
  homeAway?: string; competition?: string | null; formation?: string | null;
  notes?: string | null;
}) {
  const id = uid();
  await db.insert(matches).values({
    id, ...data,
    homeAway: data.homeAway ?? 'home',
    createdAt: Date.now(),
  });
  return getMatch(id);
}

export async function updateMatch(id: string, data: Partial<{
  opponent: string; date: string; time: string | null; venue: string | null;
  homeAway: string; competition: string | null; formation: string | null; notes: string | null;
  goalsFor: number | null; goalsAgainst: number | null;
  substitutions: string | null; cards: string | null;
}>) {
  await db.update(matches).set(data).where(eq(matches.id, id));
}

export async function deleteMatch(id: string) {
  await db.delete(matchConvocations).where(eq(matchConvocations.matchId, id));
  await db.delete(matchLineup).where(eq(matchLineup.matchId, id));
  await db.delete(matchGoals).where(eq(matchGoals.matchId, id));
  await db.delete(matches).where(eq(matches.id, id));
}

// ─── MATCH CONVOCATIONS ───────────────────────────────────────────────────────
export async function setConvocations(matchId: string, playerIds: { playerId: string; jerseyNumber?: number | null }[]) {
  await db.delete(matchConvocations).where(eq(matchConvocations.matchId, matchId));
  if (playerIds.length > 0) {
    await db.insert(matchConvocations).values(
      playerIds.map(p => ({ id: uid(), matchId, playerId: p.playerId, jerseyNumber: p.jerseyNumber ?? null }))
    );
  }
}

export async function addConvocation(matchId: string, playerId: string, jerseyNumber?: number | null) {
  // Check not already there
  const existing = await db.select().from(matchConvocations)
    .where(eq(matchConvocations.matchId, matchId));
  if (existing.some(e => e.playerId === playerId)) return;
  await db.insert(matchConvocations).values({ id: uid(), matchId, playerId, jerseyNumber: jerseyNumber ?? null });
}

export async function removeConvocation(matchId: string, playerId: string) {
  const rows = await db.select().from(matchConvocations)
    .where(eq(matchConvocations.matchId, matchId));
  const row = rows.find(r => r.playerId === playerId);
  if (row) await db.delete(matchConvocations).where(eq(matchConvocations.id, row.id));
}

// ─── MATCH LINEUP ─────────────────────────────────────────────────────────────
export async function setLineup(matchId: string, entries: {
  playerId: string; positionRole?: string | null; jerseyNumber?: number | null;
  isCaptain?: boolean; isViceCaptain?: boolean;
  isFreekickTaker?: boolean; isCornerTaker?: boolean; isPenaltyTaker?: boolean; isWallPlayer?: boolean;
  posX?: number | null; posY?: number | null; order?: number;
}[]) {
  await db.delete(matchLineup).where(eq(matchLineup.matchId, matchId));
  if (entries.length > 0) {
    await db.insert(matchLineup).values(
      entries.map((e, i) => ({ id: uid(), matchId, order: e.order ?? i, ...e }))
    );
  }
}

export async function updateLineupPlayer(lineupId: string, data: Partial<{
  positionRole: string | null; jerseyNumber: number | null;
  isCaptain: boolean; isViceCaptain: boolean;
  isFreekickTaker: boolean; isCornerTaker: boolean; isPenaltyTaker: boolean; isWallPlayer: boolean;
  posX: number | null; posY: number | null;
}>) {
  await db.update(matchLineup).set(data).where(eq(matchLineup.id, lineupId));
}

// ─── MATCH GOALS ─────────────────────────────────────────────────────────────
export async function addGoal(matchId: string, data: {
  playerId?: string | null; minute?: number | null; type?: string; notes?: string | null;
}) {
  const id = uid();
  await db.insert(matchGoals).values({ id, matchId, type: data.type ?? 'goal', ...data });
  return id;
}

export async function removeGoal(goalId: string) {
  await db.delete(matchGoals).where(eq(matchGoals.id, goalId));
}

// ─── PLAYER STATS (computed from local DB) ────────────────────────────────────
export async function computePlayerStats(playerId: string) {
  const allMatches = await db.select().from(matches).orderBy(desc(matches.date));

  let convocazioni = 0, titolare = 0, presenze = 0;
  let goalsScored = 0, yellowCards = 0, redCards = 0;
  let wins = 0, draws = 0, losses = 0;
  const matchHistory: any[] = [];

  for (const match of allMatches) {
    const convRows = await db.select().from(matchConvocations)
      .where(eq(matchConvocations.matchId, match.id));
    const lineupRows = await db.select().from(matchLineup)
      .where(eq(matchLineup.matchId, match.id));
    const goalRows = await db.select().from(matchGoals)
      .where(eq(matchGoals.matchId, match.id));
    const subs = parseJSON<any[]>(match.substitutions, []);
    const cards = parseJSON<any[]>(match.cards, []);

    const inLineup = lineupRows.some(l => l.playerId === playerId);
    const inConvocations = convRows.some(c => c.playerId === playerId);
    const subIn = subs.find((s: any) => s.playerInId === playerId);
    const subOut = subs.find((s: any) => s.playerOutId === playerId);

    if (!inLineup && !inConvocations && !subIn) continue;

    if (inConvocations || inLineup) convocazioni++;

    let role: 'titolare' | 'subentrato' | 'panchina' | null = null;
    if (inLineup) {
      role = 'titolare';
      titolare++;
      presenze++;
    } else if (subIn) {
      role = 'subentrato';
      presenze++;
    } else if (inConvocations) {
      role = 'panchina';
    }

    let matchGoalCount = 0;
    for (const g of goalRows) {
      if (g.playerId === playerId && g.type !== 'autogoal') {
        goalsScored++;
        matchGoalCount++;
      }
    }

    let matchYellow = false, matchRed = false;
    for (const card of cards) {
      if (card.playerId === playerId) {
        if (card.type === 'yellow') { yellowCards++; matchYellow = true; }
        else if (card.type === 'red') { redCards++; matchRed = true; }
      }
    }

    if ((role === 'titolare' || role === 'subentrato') &&
        match.goalsFor != null && match.goalsAgainst != null) {
      if (match.goalsFor > match.goalsAgainst) wins++;
      else if (match.goalsFor === match.goalsAgainst) draws++;
      else losses++;
    }

    matchHistory.push({
      matchId: match.id,
      opponent: match.opponent,
      date: match.date,
      competition: match.competition ?? null,
      role,
      goalsFor: match.goalsFor ?? null,
      goalsAgainst: match.goalsAgainst ?? null,
      yellowCard: matchYellow,
      redCard: matchRed,
      goalsScored: matchGoalCount,
    });
  }

  matchHistory.sort((a, b) => b.date.localeCompare(a.date));
  return { convocazioni, titolare, presenze, goalsScored, yellowCards, redCards, wins, draws, losses, matchHistory };
}
