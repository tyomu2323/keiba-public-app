import { db, nowIso } from '../db.js';

function pctFlags(percentile) {
  return { top15: percentile <= 0.15 ? 1 : 0, top25: percentile <= 0.25 ? 1 : 0 };
}

export async function fetchData({ mode='manual', dateFrom, dateTo } = {}) {
  const today = new Date().toISOString().slice(0,10);
  const venues = [
    { code: 'TOK', name: '東京' },
    { code: 'KYO', name: '京都' },
    { code: 'HAK', name: '函館' }
  ];
  const races = [];
  for (const v of venues) {
    for (let no = 1; no <= 12; no++) {
      const isMain = no === 11;
      const surface = no % 3 === 0 ? 'ダート' : '芝';
      const distance = surface === '芝' ? [1200,1400,1600,1800,2000,2200][no % 6] : [1200,1400,1700,1800][no % 4];
      races.push({
        id: `${today}-${v.code}-${String(no).padStart(2,'0')}`,
        date: today,
        venue: v.name,
        race_no: no,
        name: isMain ? 'サンプルメイン' : `サンプル${no}R`,
        surface,
        distance,
        course_turn: surface === '芝' ? '左' : '右',
        going: no % 4 === 0 ? '稍重' : '良',
        weather: '晴',
        class_name: no === 11 ? 'OP' : '未勝利',
        age_condition: '3歳以上',
        start_time: `${String(9 + Math.floor(no / 2)).padStart(2,'0')}:${no % 2 ? '50' : '20'}`
      });
    }
  }

  const horses = [
    ['h001','リバーベッドスター'], ['h002','アクアブレイブ'], ['h003','モスグリーン'], ['h004','フォールライン'],
    ['h005','バイアスシーカー'], ['h006','オッズハンター'], ['h007','パドックライト'], ['h008','ターフログ']
  ];
  const jockeys = ['武豊','川田','ルメール','横山','坂井','戸崎','松山','岩田'];

  const insertRace = db.prepare(`INSERT OR REPLACE INTO races
    (id,date,venue,race_no,name,surface,distance,course_turn,going,weather,class_name,age_condition,start_time,updated_at)
    VALUES (@id,@date,@venue,@race_no,@name,@surface,@distance,@course_turn,@going,@weather,@class_name,@age_condition,@start_time,@updated_at)`);
  const insertHorse = db.prepare(`INSERT OR REPLACE INTO horses
    (id,name,sex,birth_year,stable,updated_at) VALUES (?,?,?,?,?,?)`);
  const insertEntry = db.prepare(`INSERT OR REPLACE INTO entries
    (race_id,horse_id,frame_no,horse_no,sex_age,carried_weight,jockey,jockey_id,trainer,trainer_id,body_weight,body_weight_diff,popularity,actual_odds,expected_win_rate,theoretical_odds,score,status,running_style,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertWorkout = db.prepare(`INSERT INTO workouts
    (race_id,horse_id,date,course,lap_text,furlong_6,furlong_5,furlong_4,furlong_3,furlong_2,furlong_1,last_furlong,total_time,intensity,rank_in_race,percentile,top15_flag,top25_flag,workout_score,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertPastRun = db.prepare(`INSERT INTO horse_past_runs
    (horse_id,date,venue,race_name,surface,distance,going,class_name,frame_no,horse_no,finish_position,popularity,odds,jockey,carried_weight,body_weight,body_weight_diff,passing_order,last_3f,time_text,time_seconds,margin,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertJockeyStat = db.prepare(`INSERT OR REPLACE INTO jockey_stats
    (jockey,period_type,date_from,date_to,venue,surface,distance,starts,wins,seconds,thirds,win_rate,place2_rate,place3_rate,win_return_rate,place_return_rate,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertCourseTrend = db.prepare(`INSERT INTO course_trends
    (venue,surface,distance,sample_from,sample_to,frame_no,running_style,starts,wins,seconds,thirds,win_rate,place3_rate,score,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertRule = db.prepare(`INSERT INTO scoring_rules (name,category,condition_json,score,enabled,sort_order,updated_at) VALUES (?,?,?,?,?,?,?)`);

  const tx = db.transaction(() => {
    for (const r of races) insertRace.run({ ...r, updated_at: nowIso() });
    for (const [id, name] of horses) insertHorse.run(id, name, id.endsWith('1') ? '牡' : '牝', 2021, 'サンプル厩舎', nowIso());
    db.prepare('DELETE FROM workouts').run();
    db.prepare('DELETE FROM horse_past_runs').run();
    db.prepare('DELETE FROM jockey_stats').run();
    db.prepare('DELETE FROM course_trends').run();

    for (const r of races) {
      const startIndex = (r.race_no + r.venue.length) % horses.length;
      for (let i = 0; i < 8; i++) {
        const h = horses[(startIndex + i) % horses.length];
        const horseNo = i + 1;
        const score = 88 - i * 5 + (r.race_no % 3);
        const expectedWinRate = Number((Math.max(3, 24 - i * 2.3)).toFixed(1));
        const theoretical = Number((100 / expectedWinRate).toFixed(1));
        const actual = Number((theoretical * (i % 2 === 0 ? 1.45 : 0.86)).toFixed(1));
        insertEntry.run(r.id, h[0], Math.ceil(horseNo/2), horseNo, i % 2 === 0 ? '牡5' : '牝4', 57, jockeys[i], `j${String(i+1).padStart(3,'0')}`, 'サンプル厩舎', 't001', 480+i*3, i-3, i+1, actual, expectedWinRate, theoretical, score, '出走予定', ['逃げ','先行','差し','追込'][i%4], nowIso());
        const isTop = i === 0;
        for (let widx = 0; widx < 3; widx++) {
          const percentile = i === 0 && widx === 0 ? 0.12 : i === 1 && widx === 0 ? 0.22 : 0.38 + i * 0.04 + widx * 0.02;
          const flags = pctFlags(percentile);
          const wDate = new Date(Date.now() - widx * 3 * 24 * 60 * 60 * 1000).toISOString().slice(0,10);
          const finalTop = isTop && widx === 0;
          insertWorkout.run(r.id, h[0], wDate, finalTop ? 'CW' : '坂路', finalTop ? '82.1-66.3-51.8-37.2-11.5' : `${(54+i/10+widx/5).toFixed(1)}-38.${i+widx}-24.${i}-12.${i+widx}`,
            finalTop ? 82.1 : null, finalTop ? 66.3 : null, finalTop ? 51.8 : Number((54+i/10+widx/5).toFixed(1)), finalTop ? 37.2 : Number(`38.${i+widx}`), finalTop ? null : Number(`24.${i}`), finalTop ? 11.5 : Number(`12.${i+widx}`), finalTop ? 11.5 : Number(`12.${i+widx}`), finalTop ? 82.1 : Number((54+i/10+widx/5).toFixed(1)), (i + widx) % 3 === 0 ? '馬なり' : (i + widx) % 3 === 1 ? '強め' : '一杯', i+1+widx, percentile, flags.top15, flags.top25, flags.top15 ? 10 : flags.top25 ? 6 : 2, nowIso());
        }

        for (let p = 1; p <= 5; p++) {
          insertPastRun.run(h[0], `2026-0${Math.max(1, 6-p)}-0${p}`, ['東京','京都','中山'][p%3], `過去サンプル${p}`, r.surface, r.distance + (p%2 ? 0 : 200), p%2 ? '良' : '稍重', '1勝C', Math.ceil(horseNo/2), horseNo, Math.min(10, i+p), Math.min(12, i+p+1), Number((3.0+i+p).toFixed(1)), jockeys[(i+p)%jockeys.length], 57, 475+i*4, p-2, `${2+p}-${3+p}-${4+p}`, Number((34.0+i/10+p/10).toFixed(1)), `1:${33+i}.${p}`, 93+i+p, `${p/10}`, nowIso());
        }
      }
    }

    for (let i = 0; i < jockeys.length; i++) {
      for (const period of ['recent_1m','year','lifetime']) {
        insertJockeyStat.run(jockeys[i], period, '2026-05-01', today, i % 2 ? '東京' : '', i % 2 ? '芝' : '', i % 2 ? 1600 : null, 40+i*3, 6+i, 5, 4, Number(((6+i)/(40+i*3)*100).toFixed(1)), 25.0, 37.5, 90+i*5, 80+i*4, nowIso());
      }
    }

    for (const venue of venues) {
      for (const surface of ['芝','ダート']) {
        for (const distance of surface === '芝' ? [1200,1600,2000] : [1200,1800]) {
          for (let frame = 1; frame <= 8; frame++) {
            insertCourseTrend.run(venue.name, surface, distance, '2016-01-01', today, frame, '', 100, 8 + (frame%3), 7, 6, 8 + (frame%3), 21 + (frame%4), frame <= 3 ? 6 : frame >= 7 ? -2 : 2, nowIso());
          }
        }
      }
    }

    if (db.prepare('SELECT COUNT(*) c FROM scoring_rules').get().c === 0) {
      const rules = [
        ['最終追い切り上位15%','workout','{"type":"top15"}',10,1,1],
        ['馬なり上位15%','workout','{"type":"best_like"}',12,1,2],
        ['同距離3着以内','past_run','{"type":"same_distance_top3"}',8,1,3],
        ['同開催場3着以内','past_run','{"type":"same_venue_top3"}',6,1,4],
        ['騎手直近1ヶ月勝率15%以上','jockey','{"type":"recent_win_rate","min":15}',5,1,5],
        ['好走枠','trend','{"type":"good_frame","min":5}',4,1,6],
        ['脚質バイアス一致','bias','{"type":"style_bias"}',5,1,7],
        ['期待値あり','odds','{"type":"value"}',5,1,8]
      ];
      for (const r of rules) insertRule.run(...r, nowIso());
    }
  });
  tx();
  return { count: races.length, message: `sample data fetched (${mode}) ${dateFrom||''} ${dateTo||''}` };
}
