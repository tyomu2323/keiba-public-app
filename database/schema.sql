-- Keiba Public Full v6 DB schema
-- SQLite初期運用向け。後からPostgreSQLへ移行しやすいよう、IDをTEXT中心にしています。

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS horses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sex TEXT DEFAULT '',
  birth_year INTEGER,
  stable TEXT DEFAULT '',
  owner TEXT DEFAULT '',
  breeder TEXT DEFAULT '',
  sire TEXT DEFAULT '',
  dam TEXT DEFAULT '',
  dam_sire TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jockeys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  affiliation TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trainers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  affiliation TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS races (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  venue TEXT NOT NULL,
  race_no INTEGER NOT NULL,
  name TEXT NOT NULL,
  surface TEXT NOT NULL,
  distance INTEGER NOT NULL,
  course_turn TEXT DEFAULT '',
  going TEXT DEFAULT '',
  weather TEXT DEFAULT '',
  class_name TEXT DEFAULT '',
  age_condition TEXT DEFAULT '',
  start_time TEXT DEFAULT '',
  updated_at TEXT NOT NULL,
  UNIQUE(date, venue, race_no)
);

CREATE TABLE IF NOT EXISTS entries (
  race_id TEXT NOT NULL,
  horse_id TEXT NOT NULL,
  frame_no INTEGER,
  horse_no INTEGER,
  sex_age TEXT DEFAULT '',
  carried_weight REAL,
  jockey_id TEXT DEFAULT '',
  jockey TEXT DEFAULT '',
  trainer_id TEXT DEFAULT '',
  trainer TEXT DEFAULT '',
  body_weight INTEGER,
  body_weight_diff INTEGER,
  popularity INTEGER,
  actual_odds REAL,
  expected_win_rate REAL,
  theoretical_odds REAL,
  score REAL DEFAULT 0,
  status TEXT DEFAULT '出走予定',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (race_id, horse_id),
  FOREIGN KEY (race_id) REFERENCES races(id),
  FOREIGN KEY (horse_id) REFERENCES horses(id)
);

CREATE TABLE IF NOT EXISTS race_results (
  race_id TEXT NOT NULL,
  horse_id TEXT NOT NULL,
  finish_position INTEGER,
  popularity INTEGER,
  odds REAL,
  frame_no INTEGER,
  horse_no INTEGER,
  jockey_id TEXT DEFAULT '',
  jockey TEXT DEFAULT '',
  passing_order TEXT DEFAULT '',
  corner_1 INTEGER,
  corner_2 INTEGER,
  corner_3 INTEGER,
  corner_4 INTEGER,
  last_3f REAL,
  time_text TEXT DEFAULT '',
  time_seconds REAL,
  margin TEXT DEFAULT '',
  prize REAL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (race_id, horse_id)
);

CREATE TABLE IF NOT EXISTS horse_past_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  horse_id TEXT NOT NULL,
  source_race_id TEXT,
  date TEXT NOT NULL,
  venue TEXT NOT NULL,
  race_name TEXT DEFAULT '',
  surface TEXT NOT NULL,
  distance INTEGER NOT NULL,
  going TEXT DEFAULT '',
  class_name TEXT DEFAULT '',
  frame_no INTEGER,
  horse_no INTEGER,
  finish_position INTEGER,
  popularity INTEGER,
  odds REAL,
  jockey TEXT DEFAULT '',
  carried_weight REAL,
  body_weight INTEGER,
  body_weight_diff INTEGER,
  passing_order TEXT DEFAULT '',
  last_3f REAL,
  time_text TEXT DEFAULT '',
  time_seconds REAL,
  margin TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id TEXT NOT NULL,
  horse_id TEXT NOT NULL,
  date TEXT,
  course TEXT,
  lap_text TEXT,
  furlong_6 REAL,
  furlong_5 REAL,
  furlong_4 REAL,
  furlong_3 REAL,
  furlong_2 REAL,
  furlong_1 REAL,
  last_furlong REAL,
  total_time REAL,
  intensity TEXT,
  rider TEXT DEFAULT '',
  rank_in_race INTEGER,
  percentile REAL,
  top15_flag INTEGER DEFAULT 0,
  top25_flag INTEGER DEFAULT 0,
  workout_score REAL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (race_id) REFERENCES races(id),
  FOREIGN KEY (horse_id) REFERENCES horses(id)
);

CREATE TABLE IF NOT EXISTS jockey_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jockey_id TEXT DEFAULT '',
  jockey TEXT NOT NULL,
  period_type TEXT NOT NULL, -- recent_1m / year / lifetime
  date_from TEXT,
  date_to TEXT,
  venue TEXT DEFAULT '',
  surface TEXT DEFAULT '',
  distance INTEGER,
  starts INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  seconds INTEGER DEFAULT 0,
  thirds INTEGER DEFAULT 0,
  win_rate REAL DEFAULT 0,
  place2_rate REAL DEFAULT 0,
  place3_rate REAL DEFAULT 0,
  win_return_rate REAL,
  place_return_rate REAL,
  updated_at TEXT NOT NULL,
  UNIQUE(jockey, period_type, date_from, date_to, venue, surface, distance)
);

CREATE TABLE IF NOT EXISTS course_trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venue TEXT NOT NULL,
  surface TEXT NOT NULL,
  distance INTEGER NOT NULL,
  sample_from TEXT,
  sample_to TEXT,
  frame_no INTEGER,
  running_style TEXT DEFAULT '', -- 逃げ/先行/差し/追込など
  starts INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  seconds INTEGER DEFAULT 0,
  thirds INTEGER DEFAULT 0,
  win_rate REAL DEFAULT 0,
  place3_rate REAL DEFAULT 0,
  score REAL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS race_trends_10y (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_name TEXT NOT NULL,
  venue TEXT DEFAULT '',
  surface TEXT DEFAULT '',
  distance INTEGER,
  year INTEGER NOT NULL,
  finish_position INTEGER,
  frame_no INTEGER,
  horse_no INTEGER,
  horse_name TEXT DEFAULT '',
  jockey TEXT DEFAULT '',
  popularity INTEGER,
  odds REAL,
  running_style TEXT DEFAULT '',
  last_3f REAL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saturday_bias_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  venue TEXT NOT NULL,
  surface TEXT NOT NULL,
  distance INTEGER,
  race_id TEXT,
  winner_frame INTEGER,
  winner_horse_no INTEGER,
  winner_style TEXT DEFAULT '',
  top3_frames TEXT DEFAULT '',
  top3_styles TEXT DEFAULT '',
  clock_level TEXT DEFAULT '', -- 高速/標準/時計かかる
  memo TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS biases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  venue TEXT NOT NULL,
  surface TEXT NOT NULL,
  inside INTEGER DEFAULT 0,
  outside INTEGER DEFAULT 0,
  front INTEGER DEFAULT 0,
  stalker INTEGER DEFAULT 0,
  closer INTEGER DEFAULT 0,
  deep_closer INTEGER DEFAULT 0,
  fast_clock INTEGER DEFAULT 0,
  slow_clock INTEGER DEFAULT 0,
  comment TEXT DEFAULT '',
  updated_at TEXT NOT NULL,
  UNIQUE(date, venue, surface)
);

CREATE TABLE IF NOT EXISTS scoring_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- past_run/workout/jockey/trend/bias/odds/manual
  condition_json TEXT NOT NULL DEFAULT '{}',
  score REAL NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS horse_scores (
  race_id TEXT NOT NULL,
  horse_id TEXT NOT NULL,
  category TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (race_id, horse_id, category, rule_name)
);

CREATE TABLE IF NOT EXISTS odds_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id TEXT NOT NULL,
  horse_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  win_odds REAL,
  place_min REAL,
  place_max REAL,
  popularity INTEGER,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id TEXT NOT NULL,
  horse_id TEXT NOT NULL,
  mark TEXT NOT NULL,
  confidence INTEGER DEFAULT 3,
  reason TEXT DEFAULT '',
  bet_note TEXT DEFAULT '',
  add_score REAL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watch_horses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  horse_id TEXT NOT NULL,
  horse_name TEXT NOT NULL,
  note TEXT DEFAULT '',
  alert_condition TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(horse_id)
);

CREATE TABLE IF NOT EXISTS fetch_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,
  source TEXT DEFAULT '',
  status TEXT NOT NULL,
  message TEXT DEFAULT '',
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_races_date_venue ON races(date, venue, race_no);
CREATE INDEX IF NOT EXISTS idx_entries_race ON entries(race_id);
CREATE INDEX IF NOT EXISTS idx_past_runs_horse ON horse_past_runs(horse_id, date);
CREATE INDEX IF NOT EXISTS idx_workouts_race ON workouts(race_id);
CREATE INDEX IF NOT EXISTS idx_jockey_stats_lookup ON jockey_stats(jockey, period_type, venue, surface, distance);
CREATE INDEX IF NOT EXISTS idx_course_trends_lookup ON course_trends(venue, surface, distance, frame_no);
CREATE INDEX IF NOT EXISTS idx_scores_race_horse ON horse_scores(race_id, horse_id);
CREATE INDEX IF NOT EXISTS idx_odds_race_time ON odds_snapshots(race_id, captured_at);
