import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ─── USERS ────────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  plainPassword: text("plain_password"),
  role: text("role").notNull().default("coach"), // coach | admin
  name: text("name"),
  teamName: text("team_name"),
  logoUrl: text("logo_url"),
  createdAt: integer("created_at").notNull(),
  // Licenza
  subscriptionStatus: text("subscription_status").notNull().default("trial"), // trial | active | expired
  subscriptionExpiry: integer("subscription_expiry"), // Unix ms timestamp
});

// ─── INVITE CODES ─────────────────────────────────────────────────────────────
export const inviteCodes = sqliteTable("invite_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  createdBy: text("created_by").notNull(),
  usedBy: text("used_by").references(() => users.id),
  usedAt: integer("used_at"),
  createdAt: integer("created_at").notNull(),
});

// Players / Rosa
export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("system-admin"),
  name: text("name").notNull(),
  number: integer("number"),
  role: text("role").notNull(), // portiere, difensore, centrocampista, attaccante
  subRole: text("sub_role"), // es. CDC, TT, ALA-S, PC, ecc.
  secondaryRole: text("secondary_role"), // ruolo secondario principale
  secondarySubRole: text("secondary_sub_role"), // sottoruolo secondario
  dateOfBirth: text("date_of_birth"), // YYYY-MM-DD
  foot: text("foot"), // destra | sinistra | entrambi
  photoUrl: text("photo_url"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
});

// Exercises / Esercizi
export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("system-admin"),
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

// Sessions / Sedute
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("system-admin"),
  title: text("title").notNull(),
  date: text("date").notNull(),
  duration: integer("duration"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
});

// Session <-> Exercise join
export const sessionExercises = sqliteTable("session_exercises", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  exerciseId: text("exercise_id").notNull().references(() => exercises.id),
  order: integer("order").notNull(),
  customDuration: integer("custom_duration"),
  notes: text("notes"),
});

// ─── MATCHES / PARTITE ───────────────────────────────────────────────────────

export const matches = sqliteTable("matches", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("system-admin"),
  opponent: text("opponent").notNull(),          // nome avversario
  date: text("date").notNull(),                  // YYYY-MM-DD
  time: text("time"),                            // HH:MM
  venue: text("venue"),                          // campo
  homeAway: text("home_away").notNull().default("home"), // home | away | neutral
  competition: text("competition"),              // campionato, coppa, amichevole...
  formation: text("formation"),                  // es. "4-3-3"
  notes: text("notes"),
  meetingTime: text("meeting_time"),             // ora appuntamento convocazione
  meetingPlace: text("meeting_place"),           // luogo appuntamento convocazione
  // Risultato
  goalsFor: integer("goals_for"),
  goalsAgainst: integer("goals_against"),
  // Sostituzioni come JSON: [{playerOutId,playerInId,minute}]
  substitutions: text("substitutions"),
  // Cartellini/Infortuni come JSON: [{playerId,type,minute,notes}]  type: yellow|red|injury
  cards: text("cards"),
  createdAt: integer("created_at").notNull(),
});

// Convocati per partita
export const matchConvocations = sqliteTable("match_convocations", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  jerseyNumber: integer("jersey_number"), // numero maglia scelto per questa partita
  rating: real("rating"), // valutazione post-partita 1-10
});

// Formazione titolare
export const matchLineup = sqliteTable("match_lineup", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  positionRole: text("position_role"),   // ruolo in campo es. "DC", "TT", "CC", "AT"
  jerseyNumber: integer("jersey_number"),
  isCaptain: integer("is_captain", { mode: "boolean" }).default(false),
  isViceCaptain: integer("is_vice_captain", { mode: "boolean" }).default(false),
  // Calci piazzati
  isFreekickTaker: integer("is_freekick_taker", { mode: "boolean" }).default(false),
  isCornerTaker: integer("is_corner_taker", { mode: "boolean" }).default(false),
  isPenaltyTaker: integer("is_penalty_taker", { mode: "boolean" }).default(false),
  isWallPlayer: integer("is_wall_player", { mode: "boolean" }).default(false),
  // Posizione sul campo (0-1 coords per il campo visivo)
  posX: real("pos_x"),
  posY: real("pos_y"),
  order: integer("order").notNull().default(0),
});

// Marcatori
export const matchGoals = sqliteTable("match_goals", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  playerId: text("player_id").references(() => players.id, { onDelete: "set null" }),
  minute: integer("minute"),
  type: text("type").notNull().default("goal"), // goal | autogoal | rigore
  notes: text("notes"),
});
