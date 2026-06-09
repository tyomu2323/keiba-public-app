import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
export const db = new Database(path.join(dataDir, 'keiba.sqlite'));

db.exec(`
CREATE TABLE IF NOT EXISTS races (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  venue TEXT NOT NULL,
  race_no INTEGER NOT NULL,
  name TEXT NOT NULL,
  surface TEXT NOT NULL,
  distance INTEGER NOT NULL,
  going TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS horses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entries (
  race_id TEXT NOT NULL,
  horse_id TEXT NOT NULL,
  frame_no INTEGER,
  horse_no INTEGER,
  jockey TEXT,
  trainer TEXT,
  score REAL DEFAULT 0,
  theoretical_odds REAL,
  actual_odds REAL,
  PRIMARY KEY (race_id, horse_id)
);
CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id TEXT NOT NULL,
  horse_id TEXT NOT NULL,
  date TEXT,
  course TEXT,
  lap_text TEXT,
  last_furlong REAL,
  total_time REAL,
  intensity TEXT,
  percentile REAL
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
  comment TEXT DEFAULT '',
  updated_at TEXT NOT NULL,
  UNIQUE(date, venue, surface)
);
CREATE TABLE IF NOT EXISTS fetch_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
`);

export function nowIso() { return new Date().toISOString(); }
