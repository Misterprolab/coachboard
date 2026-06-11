import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ─── COACH PROFILE ────────────────────────────────────────────────────────────
export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey(), // always 1
  name: text("name").notNull().default(""),
  teamName: text("team_name").notNull().default(""),
  logoUrl: text("logo_url"),
  createdAt: integer("created_at").notNull(),
});

// ─── PLAYERS / ROSA ──────────────────────────────────────────────────────────
export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  number: integer("number"),
  role: text("role").notNull(),
  subRole: text("sub_role"),
  secondaryRole: text("secondary_role"),
  secondarySubRole: text("secondary_sub_role"),
  dateOfBirth: text("date_of_birth"),
  foot: text("foot"),
  photoUrl: text("photo_url"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
});

// ─── EXERCISES ───────────────────────────────────────────────────────────────
export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  category: text("category").notNull(),
  description: text("description").notNull(),
  descriptionEn: text("description_en"),
  duration: integer("duration").notNull(),
  players: integer("players"),
  intensity: text("intensity").notNull(),
  materials: text("materials"),
  primaryObjective: text("primary_objective"),
  secondaryObjectives: text("secondary_objectives"),
  isCustom: integer("is_custom", { mode: "boolean" }).default(false),
  diagramImage: text("diagram_image"),
  createdAt: integer("created_at").notNull(),
});

// ─── SESSIONS ────────────────────────────────────────────────────────────────
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  duration: integer("duration"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
});

export const sessionExercises = sqliteTable("session_exercises", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  exerciseId: text("exercise_id").notNull(),
  order: integer("order").notNull(),
  customDuration: integer("custom_duration"),
  notes: text("notes"),
});

// ─── MATCHES / PARTITE ───────────────────────────────────────────────────────
export const matches = sqliteTable("matches", {
  id: text("id").primaryKey(),
  opponent: text("opponent").notNull(),
  date: text("date").notNull(),
  time: text("time"),
  venue: text("venue"),
  homeAway: text("home_away").notNull().default("home"),
  competition: text("competition"),
  formation: text("formation"),
  notes: text("notes"),
  goalsFor: integer("goals_for"),
  goalsAgainst: integer("goals_against"),
  substitutions: text("substitutions"), // JSON
  cards: text("cards"),                 // JSON
  createdAt: integer("created_at").notNull(),
});

export const matchConvocations = sqliteTable("match_convocations", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull(),
  playerId: text("player_id").notNull(),
  jerseyNumber: integer("jersey_number"),
});

export const matchLineup = sqliteTable("match_lineup", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull(),
  playerId: text("player_id").notNull(),
  positionRole: text("position_role"),
  jerseyNumber: integer("jersey_number"),
  isCaptain: integer("is_captain", { mode: "boolean" }).default(false),
  isViceCaptain: integer("is_vice_captain", { mode: "boolean" }).default(false),
  isFreekickTaker: integer("is_freekick_taker", { mode: "boolean" }).default(false),
  isCornerTaker: integer("is_corner_taker", { mode: "boolean" }).default(false),
  isPenaltyTaker: integer("is_penalty_taker", { mode: "boolean" }).default(false),
  isWallPlayer: integer("is_wall_player", { mode: "boolean" }).default(false),
  posX: real("pos_x"),
  posY: real("pos_y"),
  order: integer("order").notNull().default(0),
});

export const matchGoals = sqliteTable("match_goals", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull(),
  playerId: text("player_id"),
  minute: integer("minute"),
  type: text("type").notNull().default("goal"),
  notes: text("notes"),
});
