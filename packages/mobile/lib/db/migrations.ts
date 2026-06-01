// Auto-generated migration SQL — runs once on first launch
export const migrations = `
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  team_name TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  number INTEGER,
  role TEXT NOT NULL,
  sub_role TEXT,
  secondary_role TEXT,
  secondary_sub_role TEXT,
  date_of_birth TEXT,
  foot TEXT,
  photo_url TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  description_en TEXT,
  duration INTEGER NOT NULL,
  players INTEGER,
  intensity TEXT NOT NULL,
  materials TEXT,
  primary_objective TEXT,
  secondary_objectives TEXT,
  is_custom INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  duration INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session_exercises (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  custom_duration INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  opponent TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  venue TEXT,
  home_away TEXT NOT NULL DEFAULT 'home',
  competition TEXT,
  formation TEXT,
  notes TEXT,
  goals_for INTEGER,
  goals_against INTEGER,
  substitutions TEXT,
  cards TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS match_convocations (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  jersey_number INTEGER
);

CREATE TABLE IF NOT EXISTS match_lineup (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  position_role TEXT,
  jersey_number INTEGER,
  is_captain INTEGER DEFAULT 0,
  is_vice_captain INTEGER DEFAULT 0,
  is_freekick_taker INTEGER DEFAULT 0,
  is_corner_taker INTEGER DEFAULT 0,
  is_penalty_taker INTEGER DEFAULT 0,
  is_wall_player INTEGER DEFAULT 0,
  pos_x REAL,
  pos_y REAL,
  "order" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS match_goals (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  player_id TEXT,
  minute INTEGER,
  type TEXT NOT NULL DEFAULT 'goal',
  notes TEXT
);
`;
