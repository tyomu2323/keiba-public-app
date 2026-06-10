import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { db, nowIso } from './db.js';
import { requireAdmin, signToken, passwordMatches } from './auth.js';
import { runFetch } from './services/fetcher.js';

const WEIGHT_BONUS_PER_KG = 0.5;

function estimatedPlaceOdds(winOdds){
  const o = Number(winOdds || 0);
  if(!o) return 0;
  return Number(Math.max(1.1, o / 3).toFixed(1));
}
function validationStats(rows){
  const out = { count: rows.length, first:0, second:0, third:0, fourth_or_worse:0, win_return_rate:0, place_return_rate:0 };
  if(!rows.length) return out;
  let winReturn = 0, placeReturn = 0;
  for(const r of rows){
    const finish = Number(r.finish_position || 99);
    if(finish === 1){ out.first++; winReturn += Number(r.odds || r.actual_odds || 0) * 100; }
    else if(finish === 2) out.second++;
    else if(finish === 3) out.third++;
    else out.fourth_or_worse++;
    if(finish <= 3) placeReturn += estimatedPlaceOdds(r.odds || r.actual_odds) * 100;
  }
  out.win_return_rate = Number((winReturn / (rows.length * 100) * 100).toFixed(1));
  out.place_return_rate = Number((placeReturn / (rows.length * 100) * 100).toFixed(1));
  out.record = `${out.first}-${out.second}-${out.third}-${out.fourth_or_worse}`;
  return out;
}
function rankedScoreRows(rankNo){
  const races = db.prepare('SELECT id FROM races ORDER BY date, venue, race_no').all();
  const rows = [];
  for(const race of races){
    const entries = db.prepare(`
      SELECT e.race_id,e.horse_id,e.score,e.actual_odds,rr.finish_position,rr.odds
      FROM entries e
      JOIN race_results rr ON rr.race_id=e.race_id AND rr.horse_id=e.horse_id
      WHERE e.race_id=?
      ORDER BY e.score DESC, e.actual_odds ASC, e.horse_no ASC
    `).all(race.id);
    if(entries[rankNo-1]) rows.push(entries[rankNo-1]);
  }
  return rows;
}


function raceTurn(venue){
  return ['東京','新潟','中京'].includes(String(venue||'')) ? '左' : '右';
}
function isSmallCourse(venue){
  return ['中山','小倉','福島','函館'].includes(String(venue||''));
}
function isBigOuterLike(venue){
  return ['東京','阪神','京都'].includes(String(venue||''));
}
function top3(p){ return Number(p?.finish_position||99) <= 3; }
function getLast3fRank(pastRun){
  const r = Number(pastRun?.last_3f_rank ?? pastRun?.agari_rank ?? pastRun?.rank_last_3f ?? 0);
  return r || 0;
}
function isSelfConditionRace(race){
  const c = String(race?.class_name||'');
  return /未勝利|1勝|2勝|3勝|500万|1000万|1600万/.test(c) && !/OP|オープン|G1|G2|G3|重賞/.test(c);
}
function isGradedRaceName(name, className=''){
  return /G1|G2|G3|重賞|オープン|OP/.test(String(name||'') + String(className||''));
}
function isHandicapRace(race){
  return /ハンデ|H|HANDICAP/i.test(String(race?.name||'') + String(race?.class_name||''));
}
function calcRuleScoresForRace(raceId){
  const race = db.prepare('SELECT * FROM races WHERE id=?').get(raceId);
  if(!race) return [];
  const entries = db.prepare('SELECT e.*, h.name FROM entries e JOIN horses h ON h.id=e.horse_id WHERE e.race_id=?').all(raceId);
  const bias = db.prepare('SELECT * FROM biases WHERE date=? AND venue=? AND surface=?').get(race.date, race.venue, race.surface) || null;
  const rules = db.prepare('SELECT * FROM scoring_rules WHERE enabled=1 ORDER BY sort_order, id').all();
  db.prepare('DELETE FROM horse_scores WHERE race_id=?').run(raceId);
  const insert = db.prepare('INSERT OR REPLACE INTO horse_scores (race_id,horse_id,category,rule_name,score,reason,updated_at) VALUES (?,?,?,?,?,?,?)');
  const maxWeight = entries.reduce((m,e)=>Math.max(m, Number(e.carried_weight||0)), 0);
  for(const e of entries){
    const workouts = db.prepare('SELECT * FROM workouts WHERE race_id=? AND horse_id=? ORDER BY date DESC, id DESC').all(raceId,e.horse_id);
    const finalW = workouts[0] || null;
    const past = db.prepare('SELECT * FROM horse_past_runs WHERE horse_id=? ORDER BY date DESC LIMIT 10').all(e.horse_id);
    const last = past[0] || null;
    const prev = past[1] || null;
    const jockeyRecent = db.prepare("SELECT * FROM jockey_stats WHERE jockey=? AND period_type='recent_1m' AND COALESCE(venue,'')='' AND COALESCE(surface,'')='' AND distance IS NULL ORDER BY id DESC LIMIT 1").get(e.jockey)
      || db.prepare("SELECT * FROM jockey_stats WHERE jockey=? AND period_type='recent_1m' ORDER BY id DESC LIMIT 1").get(e.jockey);
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
        if(c.type==='distance_experience' && past.some(p=>Number(p.distance)===Number(race.distance) && top3(p))){ok=true; reason=`距離${race.distance}mで3着以内あり`;}
        if(c.type==='same_distance_top3' && past.some(p=>p.surface===race.surface && Number(p.distance)===Number(race.distance) && top3(p))){ok=true; reason=`同距離・同馬場で3着以内あり`;}
        if(c.type==='same_venue_top3' && past.some(p=>p.venue===race.venue && top3(p))){ok=true; reason=`${race.venue}で3着以内あり`;}
        if(c.type==='same_condition_top3' && past.some(p=>p.venue===race.venue && p.surface===race.surface && Number(p.distance)===Number(race.distance) && top3(p))){ok=true; reason=`同条件（${race.venue}${race.surface}${race.distance}m）で3着以内あり`;}
        if(c.type==='same_turn_top3' && past.some(p=>raceTurn(p.venue)===raceTurn(race.venue) && top3(p))){ok=true; reason=`${raceTurn(race.venue)}回りで3着以内あり`;}
        if(c.type==='small_course_top3' && isSmallCourse(race.venue) && past.some(p=>isSmallCourse(p.venue) && top3(p))){ok=true; reason='小回りコース実績あり';}
        if(c.type==='big_outer_top3' && isBigOuterLike(race.venue) && past.some(p=>isBigOuterLike(p.venue) && top3(p))){ok=true; reason='大箱/外回り系コース実績あり';}
        if(c.type==='last_run_agari_top3' && getLast3fRank(last)>0 && getLast3fRank(last)<=3){ok=true; reason=`前走上がり${getLast3fRank(last)}位`;}
        if(c.type==='last_run_distance_up_top3' && last && prev && Number(last.distance)>Number(prev.distance) && top3(last)){ok=true; reason=`前走が距離延長で${last.finish_position}着`;}
        if(c.type==='last_run_distance_down_top3' && last && prev && Number(last.distance)<Number(prev.distance) && top3(last)){ok=true; reason=`前走が距離短縮で${last.finish_position}着`;}
        if(c.type==='graded_top5' && past.some(p=>isGradedRaceName(p.race_name,p.class_name) && Number(p.finish_position||99)<=5)){ok=true; reason='重賞/OPで5着以内あり';}
        if(c.type==='last3f_good' && past.some(p=>Number(p.last_3f)>0 && Number(p.last_3f)<=34.5)){ok=true; reason='過去走で上がり34.5秒以内あり';}
      }
      if(rule.category==='race_class'){
        if(c.type==='self_condition' && isSelfConditionRace(race)){ok=true; reason='自己条件レース';}
      }
      if(rule.category==='weight'){
        if(c.type==='handicap_light' && maxWeight>0){
          const diff = maxWeight - Number(e.carried_weight||0);
          if(diff>0){ ok=true; reason=`斤量補正：最重量${maxWeight}kgから${diff.toFixed(1)}kg軽い × ${WEIGHT_BONUS_PER_KG} = +${(diff*WEIGHT_BONUS_PER_KG).toFixed(1)}（全レース適用）`; }
        }
      }
      if(rule.category==='manual_note'){
        if(c.type==='distance_up_note'){ reason='但し書き：距離延長が合いそうかは手動判断。初期点0。'; }
        if(c.type==='distance_down_note'){ reason='但し書き：距離短縮が合いそうかは手動判断。初期点0。'; }
        ok = true;
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
      if(ok) {
        const score = c.type==='handicap_light' ? Math.max(0, Number(((maxWeight - Number(e.carried_weight||0))*WEIGHT_BONUS_PER_KG).toFixed(1))) : Number(rule.score||0);
        insert.run(raceId,e.horse_id,rule.category,rule.name,score,reason,nowIso());
      }
    }
  }
  const rows = db.prepare('SELECT * FROM horse_scores WHERE race_id=?').all(raceId);
  for(const e of entries){
    const ruleSum = rows.filter(r=>r.horse_id===e.horse_id).reduce((a,b)=>a+Number(b.score||0),0);
    const manualSum = db.prepare('SELECT COALESCE(SUM(score),0) s FROM manual_horse_scores WHERE race_id=? AND horse_id=?').get(raceId,e.horse_id)?.s || 0;
    db.prepare('UPDATE entries SET score=? WHERE race_id=? AND horse_id=?').run(Number((ruleSum+manualSum).toFixed(1)),raceId,e.horse_id);
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
      COALESCE(e.manual_mark,'') mark,
      0 rec_add_score,
      '' rec_reason,
      '' bet_note,
      COALESCE((SELECT SUM(score) FROM horse_scores hs WHERE hs.race_id=e.race_id AND hs.horse_id=e.horse_id),0) auto_score,
      COALESCE((SELECT SUM(score) FROM manual_horse_scores ms WHERE ms.race_id=e.race_id AND ms.horse_id=e.horse_id),0) manual_score
    FROM entries e JOIN horses h ON h.id=e.horse_id
    WHERE e.race_id=? ORDER BY e.horse_no
  `).all(req.params.id);
  const workouts = db.prepare('SELECT * FROM workouts WHERE race_id=? ORDER BY horse_id, date DESC, id DESC').all(req.params.id);
  calcRuleScoresForRace(req.params.id);
  const autoScores = db.prepare('SELECT race_id,horse_id,category,rule_name,score,reason,updated_at FROM horse_scores WHERE race_id=?').all(req.params.id);
  const manualScores = db.prepare("SELECT race_id,horse_id,category,label AS rule_name,score,reason,updated_at FROM manual_horse_scores WHERE race_id=?").all(req.params.id).map(r=>({...r, category: r.category || 'manual'}));
  const scores = [...autoScores, ...manualScores].sort((a,b)=>String(a.horse_id).localeCompare(String(b.horse_id)) || String(a.category).localeCompare(String(b.category)) || String(a.rule_name).localeCompare(String(b.rule_name)));
  const bias = db.prepare('SELECT * FROM biases WHERE date=? AND venue=? AND surface=?').get(race.date, race.venue, race.surface) || null;
  const updatedEntries = db.prepare(`
    SELECT e.*, h.name,
      COALESCE(e.manual_mark,'') mark,
      0 rec_add_score,
      '' rec_reason,
      '' bet_note,
      COALESCE((SELECT SUM(score) FROM horse_scores hs WHERE hs.race_id=e.race_id AND hs.horse_id=e.horse_id),0) auto_score,
      COALESCE((SELECT SUM(score) FROM manual_horse_scores ms WHERE ms.race_id=e.race_id AND ms.horse_id=e.horse_id),0) manual_score
    FROM entries e JOIN horses h ON h.id=e.horse_id
    WHERE e.race_id=? ORDER BY e.horse_no
  `).all(req.params.id);
  res.json({ race, entries: updatedEntries, workouts, scores, bias });
});

app.get('/api/recommendations', (req, res) => {
  // V21: おすすめ馬はレース印ではなく、POG的な将来期待馬として watch_horses を表示します。
  const rows = db.prepare(`
    SELECT w.id, w.horse_id, w.horse_name, w.note, w.alert_condition, w.updated_at,
      e.race_id, e.frame_no, e.horse_no, r.date, r.venue, r.race_no, r.name race_name, r.surface, r.distance
    FROM watch_horses w
    LEFT JOIN entries e ON e.horse_id=w.horse_id
    LEFT JOIN races r ON r.id=e.race_id
    WHERE w.active=1
    ORDER BY w.updated_at DESC, w.horse_name
  `).all();
  res.json({ recommendations: rows });
});

app.get('/api/admin/horses/search', requireAdmin, (req, res) => {
  const q = String(req.query.q || '').trim();
  const like = `%${q}%`;
  const rows = q
    ? db.prepare('SELECT id, name, sex, birth_date, sire, dam_sire FROM horses WHERE name LIKE ? ORDER BY name LIMIT 30').all(like)
    : db.prepare('SELECT id, name, sex, birth_date, sire, dam_sire FROM horses ORDER BY updated_at DESC, name LIMIT 30').all();
  res.json({ horses: rows });
});

app.get('/api/horses/:id', (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const horse = db.prepare('SELECT * FROM horses WHERE id=?').get(id);
  if(!horse) return res.status(404).json({ error: 'not_found' });
  const entries = db.prepare(`
    SELECT e.*, r.date, r.venue, r.race_no, r.name race_name, r.surface, r.distance, r.going
    FROM entries e JOIN races r ON r.id=e.race_id
    WHERE e.horse_id=?
    ORDER BY r.date DESC, r.venue, r.race_no
  `).all(id);
  const workouts = db.prepare('SELECT * FROM workouts WHERE horse_id=? ORDER BY date DESC, id DESC LIMIT 100').all(id);
  const pastRuns = db.prepare('SELECT * FROM horse_past_runs WHERE horse_id=? ORDER BY date DESC LIMIT 50').all(id);
  const watch = db.prepare('SELECT * FROM watch_horses WHERE horse_id=? OR horse_name=?').get(id, horse.name) || null;
  const scores = db.prepare('SELECT * FROM horse_scores WHERE horse_id=? ORDER BY updated_at DESC LIMIT 50').all(id);
  res.json({ horse, entries, workouts, pastRuns, watch, scores });
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

app.get('/api/admin/validation', requireAdmin, (req, res) => {
  const workoutPlus3Rows = db.prepare(`
    SELECT * FROM (
      SELECT e.race_id,e.horse_id,e.actual_odds,rr.finish_position,rr.odds,
        COALESCE((SELECT SUM(score) FROM manual_horse_scores ms WHERE ms.race_id=e.race_id AND ms.horse_id=e.horse_id AND ms.category='workout_manual'),0) workout_manual_score
      FROM entries e
      JOIN race_results rr ON rr.race_id=e.race_id AND rr.horse_id=e.horse_id
    ) x
    WHERE workout_manual_score >= 3
  `).all();
  const rank1 = rankedScoreRows(1);
  const rank2 = rankedScoreRows(2);
  const rank3 = rankedScoreRows(3);
  res.json({
    note: '複勝回収率はサンプルでは単勝オッズからの暫定推定です。JRA-VAN結果払戻データ接続後は実払戻で計算します。',
    workout_plus3: validationStats(workoutPlus3Rows),
    score_rank_1: validationStats(rank1),
    score_rank_2: validationStats(rank2),
    score_rank_3: validationStats(rank3)
  });
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
  const { horse_id='', horse_name='', note='', alert_condition='注目' } = req.body || {};
  let horse = null;
  if (horse_id) horse = db.prepare('SELECT * FROM horses WHERE id=?').get(horse_id);
  const nameInput = String(horse_name || '').trim();
  if (!horse && nameInput) horse = db.prepare('SELECT * FROM horses WHERE name=?').get(nameInput);
  if (!horse && nameInput) {
    const id = 'watch-' + Buffer.from(nameInput).toString('hex').slice(0, 24);
    db.prepare('INSERT OR IGNORE INTO horses (id,name,updated_at) VALUES (?,?,?)').run(id, nameInput, nowIso());
    horse = { id, name: nameInput };
  }
  if (!horse) return res.status(400).json({ error: 'horse_id or horse_name is required' });
  db.prepare(`INSERT INTO watch_horses (horse_id,horse_name,note,alert_condition,active,updated_at) VALUES (?,?,?,?,1,?)
    ON CONFLICT(horse_id) DO UPDATE SET horse_name=excluded.horse_name,note=excluded.note,alert_condition=excluded.alert_condition,active=1,updated_at=excluded.updated_at`)
    .run(horse.id, horse.name, note, alert_condition, nowIso());
  res.json({ ok: true, horse_id: horse.id, horse_name: horse.name });
});

app.post('/api/admin/marks', requireAdmin, (req, res) => {
  const { race_id, horse_id, mark='' } = req.body || {};
  if (!race_id || !horse_id) return res.status(400).json({ error: 'race_id and horse_id are required' });
  db.prepare('UPDATE entries SET manual_mark=?, updated_at=? WHERE race_id=? AND horse_id=?')
    .run(String(mark || ''), nowIso(), race_id, horse_id);
  res.json({ ok: true, mark: String(mark || '') });
});

// 互換用：旧APIを呼んでも加点やおすすめ馬にはしない。印だけ保存します。
app.post('/api/admin/recommendations', requireAdmin, (req, res) => {
  const { race_id, horse_id, mark='' } = req.body || {};
  if (!race_id || !horse_id) return res.status(400).json({ error: 'race_id and horse_id are required' });
  db.prepare('UPDATE entries SET manual_mark=?, updated_at=? WHERE race_id=? AND horse_id=?')
    .run(String(mark || ''), nowIso(), race_id, horse_id);
  res.json({ ok: true, mark: String(mark || '') });
});


app.get('/api/admin/races/:id/workout-scoring', requireAdmin, (req, res) => {
  const race = db.prepare('SELECT * FROM races WHERE id=?').get(req.params.id);
  if (!race) return res.status(404).json({ error: 'not_found' });
  const entries = db.prepare(`
    SELECT e.*, h.name,
      COALESCE((SELECT SUM(score) FROM manual_horse_scores ms WHERE ms.race_id=e.race_id AND ms.horse_id=e.horse_id AND ms.category='workout_manual'),0) workout_manual_score,
      COALESCE((SELECT SUM(score) FROM manual_horse_scores ms WHERE ms.race_id=e.race_id AND ms.horse_id=e.horse_id AND ms.category='distance_fit_manual'),0) distance_fit_manual_score,
      COALESCE((SELECT score FROM manual_horse_scores ms WHERE ms.race_id=e.race_id AND ms.horse_id=e.horse_id AND ms.category='distance_fit_manual' AND ms.label='distance_up_fit' LIMIT 1),0) distance_up_fit_score,
      COALESCE((SELECT score FROM manual_horse_scores ms WHERE ms.race_id=e.race_id AND ms.horse_id=e.horse_id AND ms.category='distance_fit_manual' AND ms.label='distance_down_fit' LIMIT 1),0) distance_down_fit_score,
      COALESCE((SELECT reason FROM manual_horse_scores ms WHERE ms.race_id=e.race_id AND ms.horse_id=e.horse_id AND ms.category='workout_manual' ORDER BY updated_at DESC LIMIT 1),'') workout_manual_reason
    FROM entries e JOIN horses h ON h.id=e.horse_id
    WHERE e.race_id=? ORDER BY e.horse_no
  `).all(req.params.id);
  const workoutRows = db.prepare('SELECT * FROM workouts WHERE race_id=? ORDER BY horse_id, date DESC, id DESC').all(req.params.id);
  const manualRows = db.prepare("SELECT horse_id,label,score,reason FROM manual_horse_scores WHERE race_id=? AND category='workout_manual'").all(req.params.id);
  const manualMap = new Map(manualRows.map(r => [String(r.label || ''), r]));
  const workouts = workoutRows.map(w => {
    const m = manualMap.get(`workout:${w.id}`) || null;
    return { ...w, manual_score: m ? Number(m.score || 0) : 0, manual_reason: m?.reason || '' };
  });
  res.json({ race, entries, workouts });
});

app.post('/api/admin/manual-scores', requireAdmin, (req, res) => {
  const { race_id, horse_id, category='manual', label='手動加点', score=0, reason='' } = req.body || {};
  if (!race_id || !horse_id) return res.status(400).json({ error: 'race_id, horse_id are required' });
  db.prepare(`INSERT INTO manual_horse_scores (race_id,horse_id,category,label,score,reason,updated_at)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(race_id,horse_id,category,label) DO UPDATE SET score=excluded.score,reason=excluded.reason,updated_at=excluded.updated_at`)
    .run(race_id, horse_id, category, label, Number(score||0), reason, nowIso());
  calcRuleScoresForRace(race_id);
  const workoutManualTotal = db.prepare("SELECT COALESCE(SUM(score),0) s FROM manual_horse_scores WHERE race_id=? AND horse_id=? AND category='workout_manual'").get(race_id, horse_id)?.s || 0;
  const distanceFitManualTotal = db.prepare("SELECT COALESCE(SUM(score),0) s FROM manual_horse_scores WHERE race_id=? AND horse_id=? AND category='distance_fit_manual'").get(race_id, horse_id)?.s || 0;
  const manualTotal = db.prepare("SELECT COALESCE(SUM(score),0) s FROM manual_horse_scores WHERE race_id=? AND horse_id=?").get(race_id, horse_id)?.s || 0;
  const entryScore = db.prepare("SELECT score FROM entries WHERE race_id=? AND horse_id=?").get(race_id, horse_id)?.score || 0;
  res.json({ ok: true, workout_manual_total: Number(workoutManualTotal), distance_fit_manual_total: Number(distanceFitManualTotal), manual_total: Number(manualTotal), entry_score: Number(entryScore) });
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


app.put('/api/admin/scoring-rules/:id', requireAdmin, (req, res) => {
  const { name, category, condition_json='{}', score=0, enabled=1, sort_order=0 } = req.body || {};
  const row = db.prepare('SELECT * FROM scoring_rules WHERE id=?').get(req.params.id);
  if(!row) return res.status(404).json({ error: 'not_found' });
  db.prepare('UPDATE scoring_rules SET name=?, category=?, condition_json=?, score=?, enabled=?, sort_order=?, updated_at=? WHERE id=?')
    .run(name || row.name, category || row.category, condition_json, Number(score)||0, enabled?1:0, Number(sort_order)||0, nowIso(), req.params.id);
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
