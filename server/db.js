import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(process.env.DB_PATH || path.join(dataDir, 'keiba.sqlite'));
db.pragma('foreign_keys = ON');

const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn('entries', 'running_style', "TEXT DEFAULT ''");
ensureColumn('biases', 'deep_closer', 'INTEGER DEFAULT 0');
ensureColumn('watch_horses', 'alert_condition', "TEXT DEFAULT ''");

export function nowIso() { return new Date().toISOString(); }
