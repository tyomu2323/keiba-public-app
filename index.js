import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { db, nowIso } from './db.js';
import { requireAdmin, signToken, passwordMatches } from './auth.js';
import { runFetch } from './services/fetcher.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === (process.env.ADMIN_USER || 'admin') && passwordMatches(password, process.env.ADMIN_PASSWORD || 'change-me')) {
    return res.json({ token: signToken(username) });
  }
  res.status(401).json({ error: 'ログイン情報が違います' });
});

app.get('/api/races', (req, res) => {
  const races = db.prepare(`SELECT * FROM races ORDER BY date, venue, race_no`).all();
  res.json({ races });
});

app.get('/api/races/:id', (req, res) => {
  const race = db.prepare('SELECT * FROM races WHERE id=?').get(req.params.id);
  if (!race) return res.status(404).json({ error: 'not_found' });
  const entries = db.prepare(`
    SELECT e.*, h.name,
      COALESCE((SELECT mark FROM recommendations r WHERE r.race_id=e.race_id AND r.horse_id=e.horse_id ORDER BY id DESC LIMIT 1),'') mark,
      COALESCE((SELECT add_score FROM recommendations r WHERE r.race_id=e.race_id AND r.horse_id=e.horse_id ORDER BY id DESC LIMIT 1),0) rec_add_score,
      COALESCE((SELECT reason FROM recommendations r WHERE r.race_id=e.race_id AND r.horse_id=e.horse_id ORDER BY id DESC LIMIT 1),'') rec_reason,
      COALESCE((SELECT bet_note FROM recommendations r WHERE r.race_id=e.race_id AND r.horse_id=e.horse_id ORDER BY id DESC LIMIT 1),'') bet_note
    FROM entries e JOIN horses h ON h.id=e.horse_id
    WHERE e.race_id=? ORDER BY e.horse_no
  `).all(req.params.id);
  const workouts = db.prepare('SELECT * FROM workouts WHERE race_id=?').all(req.params.id);
  const bias = db.prepare('SELECT * FROM biases WHERE date=? AND venue=? AND surface=?').get(race.date, race.venue, race.surface) || null;
  res.json({ race, entries, workouts, bias });
});

app.get('/api/recommendations', (req, res) => {
  const rows = db.prepare(`
    SELECT rec.*, h.name horse_name, races.name race_name, races.date, races.venue, races.race_no
    FROM recommendations rec
    JOIN horses h ON h.id=rec.horse_id
    JOIN races ON races.id=rec.race_id
    ORDER BY races.date, races.venue, races.race_no, CASE rec.mark WHEN '◎' THEN 1 WHEN '○' THEN 2 WHEN '▲' THEN 3 WHEN '△' THEN 4 ELSE 9 END
  `).all();
  res.json({ recommendations: rows });
});

app.post('/api/admin/fetch', requireAdmin, async (req, res) => {
  try {
    const result = await runFetch({ mode: req.body?.mode || 'manual', ...req.body });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/admin/logs', requireAdmin, (req, res) => {
  res.json({ logs: db.prepare('SELECT * FROM fetch_logs ORDER BY id DESC LIMIT 50').all() });
});

app.post('/api/admin/recommendations', requireAdmin, (req, res) => {
  const { race_id, horse_id, mark, confidence=3, reason='', bet_note='', add_score=0 } = req.body || {};
  if (!race_id || !horse_id || !mark) return res.status(400).json({ error: 'race_id, horse_id, mark are required' });
  db.prepare(`INSERT INTO recommendations (race_id,horse_id,mark,confidence,reason,bet_note,add_score,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(race_id, horse_id, mark, confidence, reason, bet_note, add_score, nowIso());
  res.json({ ok: true });
});

app.post('/api/admin/biases', requireAdmin, (req, res) => {
  const { date, venue, surface, inside=0, outside=0, front=0, stalker=0, closer=0, comment='' } = req.body || {};
  if (!date || !venue || !surface) return res.status(400).json({ error: 'date, venue, surface are required' });
  db.prepare(`INSERT INTO biases (date,venue,surface,inside,outside,front,stalker,closer,comment,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(date,venue,surface) DO UPDATE SET inside=excluded.inside,outside=excluded.outside,front=excluded.front,stalker=excluded.stalker,closer=excluded.closer,comment=excluded.comment,updated_at=excluded.updated_at`)
    .run(date, venue, surface, inside, outside, front, stalker, closer, comment, nowIso());
  res.json({ ok: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Keiba app running: http://localhost:${port}`));
