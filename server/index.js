import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { db, nowIso } from './db.js';
import { requireAdmin, signToken, passwordMatches } from './auth.js';
import { runFetch } from './services/fetcher.js';

function calcRuleScoresForRace(raceId){
  const race = db.prepare('SELECT * FROM races WHERE id=?').get(raceId);
  if(!race) return [];
  const entries = db.prepare('SELECT e.*, h.name FROM entries e JOIN horses h ON h.id=e.horse_id WHERE e.race_id=?').all(raceId);
  const bias = db.prepare('SELECT * FROM biases WHERE date=? AND venue=? AND surface=?').get(race.date, race.venue, race.surface) || null;
  const rules = db.prepare('SELECT * FROM scoring_rules WHERE enabled=1 ORDER BY sort_order, id').all();
  db.prepare('DELETE FROM horse_scores WHERE race_id=?').run(raceId);
  const insert = db.prepare('INSERT OR REPLACE INTO horse_scores (race_id,horse_id,category,rule_name,score,reason,updated_at) VALUES (?,?,?,?,?,?,?)');
  for(const e of entries){
    const workouts = db.prepare('SELECT * FROM workouts WHERE race_id=? AND horse_id=? ORDER BY date DESC, id DESC').all(raceId,e.horse_id);
    const finalW = workouts[0] || null;
    const past = db.prepare('SELECT * FROM horse_past_runs WHERE horse_id=? ORDER BY date DESC LIMIT 5').all(e.horse_id);
    const jockeyRecent = db.prepare("SELECT * FROM jockey_stats WHERE jockey=? AND period_type='recent_1m' ORDER BY id DESC LIMIT 1").get(e.jockey);
    const trend = db.prepare('SELECT * FROM course_trends WHERE venue=? AND surface=? AND distance=? AND frame_no=? ORDER BY id DESC LIMIT 1').get(race.venue,race.surface,race.distance,e.frame_no);
    for(const rule of rules){
      let c={}; try{ c=JSON.parse(rule.condition_json||'{}') }catch{}
      let ok=false, reason='';
      if(rule.category==='workout'){
        if(c.type==='top15' && finalW?.top15_flag){ok=true; reason=`最終追い切りが上位15%（${finalW.course} ${finalW.lap_text} ${finalW.intensity}）`;}
        if(c.type==='top25' && finalW?.top25_flag){ok=true; reason=`最終追い切りが上位25%（${finalW.course} ${finalW.lap_text} ${finalW.intensity}）`;}
        if(c.type==='best_like' && finalW && Number(finalW.percentile)<=0.15 && String(finalW.intensity).includes('馬なり')){ok=true; reason='馬なりで上位15%の好内容';}
      }
      if(rule.category==='past_run'){
        if(c.type==='same_distance_top3' && past.some(p=>p.surface===race.surface && Number(p.distance)===Number(race.distance) && Number(p.finish_position)<=3)){ok=true; reason=`同条件距離で3着以内あり`;}
        if(c.type==='same_venue_top3' && past.some(p=>p.venue===race.venue && p.surface===race.surface && Number(p.finish_position)<=3)){ok=true; reason=`同開催場で3着以内あり`;}
        if(c.type==='last3f_good' && past.some(p=>Number(p.last_3f)>0 && Number(p.last_3f)<=34.5)){ok=true; reason='過去走で上がり34.5秒以内あり';}
      }
      if(rule.category==='jockey'){
        if(c.type==='recent_win_rate' && Number(jockeyRecent?.win_rate||0)>=Number(c.min||15)){ok=true; reason=`騎手直近1ヶ月勝率 ${jockeyRecent.win_rate}%`;}
      }
      if(rule.category==='trend'){
        if(c.type==='good_frame' && Number(trend?.score||0)>=Number(c.min||5)){ok=true; reason=`${race.venue}${race.surface}${race.distance}mで枠傾向プラス`;}
      }
      if(rule.category==='bias' && bias){
        const map={逃げ:'front',先行:'stalker',差し:'closer',追込:'deep_closer'};
        const k=map[e.running_style]||'';
        if(c.type==='style_bias' && k && Number(bias[k]||0)>0){ok=true; reason=`手入力バイアス：${e.running_style}+${bias[k]}`;}
        if(c.type==='inside_bias' && Number(e.frame_no)<=3 && Number(bias.inside||0)>0){ok=true; reason=`手入力バイアス：内有利+${bias.inside}`;}
        if(c.type==='outside_bias' && Number(e.frame_no)>=6 && Number(bias.outside||0)>0){ok=true; reason=`手入力バイアス：外有利+${bias.outside}`;}
      }
      if(rule.category==='odds'){
        if(c.type==='value' && Number(e.actual_odds||0)>Number(e.theoretical_odds||999)){ok=true; reason=`実オッズ${e.actual_odds} > 理論${e.theoretical_odds}`;}
      }
      if(ok) insert.run(raceId,e.horse_id,rule.category,rule.name,rule.score,reason,nowIso());
    }
  }
  const rows = db.prepare('SELECT * FROM horse_scores WHERE race_id=?').all(raceId);
  for(const e of entries){
    const ruleSum = rows.filter(r=>r.horse_id===e.horse_id).reduce((a,b)=>a+Number(b.score||0),0);
    const recAdd = db.prepare('SELECT COALESCE(SUM(add_score),0) s FROM recommendations WHERE race_id=? AND horse_id=?').get(raceId,e.horse_id)?.s || 0;
    db.prepare('UPDATE entries SET score=? WHERE race_id=? AND horse_id=?').run(Number((ruleSum+recAdd).toFixed(1)),raceId,e.horse_id);
  }
  return rows;
}

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
  const workouts = db.prepare('SELECT * FROM workouts WHERE race_id=? ORDER BY horse_id, date DESC, id DESC').all(req.params.id);
  calcRuleScoresForRace(req.params.id);
  const scores = db.prepare('SELECT * FROM horse_scores WHERE race_id=? ORDER BY horse_id, category, rule_name').all(req.params.id);
  const bias = db.prepare('SELECT * FROM biases WHERE date=? AND venue=? AND surface=?').get(race.date, race.venue, race.surface) || null;
  const updatedEntries = db.prepare(`
    SELECT e.*, h.name,
      COALESCE((SELECT mark FROM recommendations r WHERE r.race_id=e.race_id AND r.horse_id=e.horse_id ORDER BY id DESC LIMIT 1),'') mark,
      COALESCE((SELECT add_score FROM recommendations r WHERE r.race_id=e.race_id AND r.horse_id=e.horse_id ORDER BY id DESC LIMIT 1),0) rec_add_score,
      COALESCE((SELECT reason FROM recommendations r WHERE r.race_id=e.race_id AND r.horse_id=e.horse_id ORDER BY id DESC LIMIT 1),'') rec_reason,
      COALESCE((SELECT bet_note FROM recommendations r WHERE r.race_id=e.race_id AND r.horse_id=e.horse_id ORDER BY id DESC LIMIT 1),'') bet_note
    FROM entries e JOIN horses h ON h.id=e.horse_id
    WHERE e.race_id=? ORDER BY e.horse_no
  `).all(req.params.id);
  res.json({ race, entries: updatedEntries, workouts, scores, bias });
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

app.get('/api/watch-horses', (req, res) => {
  const rows = db.prepare(`
    SELECT w.*, e.race_id, e.frame_no, e.horse_no, r.date, r.venue, r.race_no, r.name race_name, r.surface, r.distance
    FROM watch_horses w
    LEFT JOIN entries e ON e.horse_id=w.horse_id
    LEFT JOIN races r ON r.id=e.race_id
    WHERE w.active=1
    ORDER BY CASE WHEN e.race_id IS NULL THEN 2 ELSE 1 END, r.date, r.venue, r.race_no, w.horse_name
  `).all();
  res.json({ watch_horses: rows });
});

app.post('/api/admin/watch-horses', requireAdmin, (req, res) => {
  const { horse_name, note='', alert_condition='注目' } = req.body || {};
  if (!horse_name || !horse_name.trim()) return res.status(400).json({ error: 'horse_name is required' });
  const name = horse_name.trim();
  let horse = db.prepare('SELECT * FROM horses WHERE name=?').get(name);
  if (!horse) {
    const id = 'watch-' + Buffer.from(name).toString('hex').slice(0, 24);
    db.prepare('INSERT OR IGNORE INTO horses (id,name,updated_at) VALUES (?,?,?)').run(id, name, nowIso());
    horse = { id, name };
  }
  db.prepare(`INSERT INTO watch_horses (horse_id,horse_name,note,alert_condition,active,updated_at) VALUES (?,?,?,?,1,?)
    ON CONFLICT(horse_name) DO UPDATE SET horse_id=excluded.horse_id,note=excluded.note,alert_condition=excluded.alert_condition,active=1,updated_at=excluded.updated_at`)
    .run(horse.id, name, note, alert_condition, nowIso());
  res.json({ ok: true });
});

app.post('/api/admin/recommendations', requireAdmin, (req, res) => {
  const { race_id, horse_id, mark, confidence=3, reason='', bet_note='', add_score=0 } = req.body || {};
  if (!race_id || !horse_id || !mark) return res.status(400).json({ error: 'race_id, horse_id, mark are required' });
  db.prepare(`INSERT INTO recommendations (race_id,horse_id,mark,confidence,reason,bet_note,add_score,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(race_id, horse_id, mark, confidence, reason, bet_note, add_score, nowIso());
  res.json({ ok: true });
});

app.post('/api/admin/biases', requireAdmin, (req, res) => {
  const { date, venue, surface, inside=0, outside=0, front=0, stalker=0, closer=0, deep_closer=0, comment='' } = req.body || {};
  if (!date || !venue || !surface) return res.status(400).json({ error: 'date, venue, surface are required' });
  db.prepare(`INSERT INTO biases (date,venue,surface,inside,outside,front,stalker,closer,deep_closer,comment,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(date,venue,surface) DO UPDATE SET inside=excluded.inside,outside=excluded.outside,front=excluded.front,stalker=excluded.stalker,closer=excluded.closer,deep_closer=excluded.deep_closer,comment=excluded.comment,updated_at=excluded.updated_at`)
    .run(date, venue, surface, inside, outside, front, stalker, closer, deep_closer, comment, nowIso());
  res.json({ ok: true });
});


app.get('/api/admin/scoring-rules', requireAdmin, (req, res) => {
  res.json({ rules: db.prepare('SELECT * FROM scoring_rules ORDER BY enabled DESC, sort_order, id').all() });
});

app.post('/api/admin/scoring-rules', requireAdmin, (req, res) => {
  const { name, category, condition_json='{}', score=0, enabled=1, sort_order=0 } = req.body || {};
  if(!name || !category) return res.status(400).json({ error: 'name and category are required' });
  db.prepare('INSERT INTO scoring_rules (name,category,condition_json,score,enabled,sort_order,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(name, category, condition_json, Number(score)||0, enabled?1:0, Number(sort_order)||0, nowIso());
  res.json({ ok: true });
});

app.post('/api/admin/scoring-rules/:id/toggle', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM scoring_rules WHERE id=?').get(req.params.id);
  if(!row) return res.status(404).json({ error: 'not_found' });
  db.prepare('UPDATE scoring_rules SET enabled=?, updated_at=? WHERE id=?').run(row.enabled?0:1, nowIso(), req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/scoring-rules/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM scoring_rules WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/score-race/:id', requireAdmin, (req, res) => {
  const scores = calcRuleScoresForRace(req.params.id);
  res.json({ ok: true, count: scores.length });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Keiba app running: http://localhost:${port}`));
