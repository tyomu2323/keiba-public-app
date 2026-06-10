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
        class_name: no === 11 ? 'G3 ハンデ' : (no % 2 === 0 ? '1勝C' : '未勝利'),
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
    (horse_id,date,venue,race_name,surface,distance,going,class_name,frame_no,horse_no,finish_position,popularity,odds,jockey,carried_weight,body_weight,body_weight_diff,passing_order,last_3f,last_3f_rank,time_text,time_seconds,margin,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertJockeyStat = db.prepare(`INSERT OR REPLACE INTO jockey_stats
    (jockey,period_type,date_from,date_to,venue,surface,distance,starts,wins,seconds,thirds,fourths,fifths_or_worse,win_rate,place2_rate,place3_rate,win_return_rate,place_return_rate,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
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
          insertPastRun.run(h[0], `2026-0${Math.max(1, 6-p)}-0${p}`, ['東京','京都','中山','小倉'][p%4], p===3 ? `G3 過去サンプル${p}` : `過去サンプル${p}`, r.surface, r.distance + (p%2 ? 0 : 200), p%2 ? '良' : '稍重', p===3 ? 'G3' : '1勝C', Math.ceil(horseNo/2), horseNo, Math.min(10, i+p), Math.min(12, i+p+1), Number((3.0+i+p).toFixed(1)), jockeys[(i+p)%jockeys.length], 57, 475+i*4, p-2, `${2+p}-${3+p}-${4+p}`, Number((34.0+i/10+p/10).toFixed(1)), Math.min(8, i+p), `1:${33+i}.${p}`, 93+i+p, `${p/10}`, nowIso());
        }
      }
    }

    for (let i = 0; i < jockeys.length; i++) {
      for (const period of ['recent_1m','year','lifetime']) {
        const baseStarts = period === 'recent_1m' ? 40+i*3 : period === 'year' ? 260+i*12 : 7200+i*80;
        const wins = period === 'recent_1m' ? 6+i : period === 'year' ? 34+i*2 : 930+i*8;
        const seconds = period === 'recent_1m' ? 5 : period === 'year' ? 28+i : 780+i*4;
        const thirds = period === 'recent_1m' ? 4 : period === 'year' ? 24+i : 690+i*3;
        const fourths = period === 'recent_1m' ? 3+i%3 : period === 'year' ? 20+i : 610+i*2;
        const others = Math.max(0, baseStarts - wins - seconds - thirds - fourths);
        insertJockeyStat.run(jockeys[i], period, '2026-05-01', today, '', '', null, baseStarts, wins, seconds, thirds, fourths, others, Number((wins/baseStarts*100).toFixed(1)), Number(((wins+seconds)/baseStarts*100).toFixed(1)), Number(((wins+seconds+thirds)/baseStarts*100).toFixed(1)), 90+i*5, 80+i*4, nowIso());
        for (const dist of [1000,1150,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100,2200,2300,2400,2500,2600,3000,3200,3400,3600]) {
          const st = Math.max(8, Math.floor(baseStarts / (period==='lifetime'?18:8)) + (dist/400)%4 + i);
          const w = Math.max(1, Math.floor(st * (0.10 + i*0.005 + (dist===1600?0.03:0))));
          const s2 = Math.max(1, Math.floor(st * 0.10));
          const t3 = Math.max(1, Math.floor(st * 0.09));
          const f4 = Math.max(0, Math.floor(st * 0.08));
          insertJockeyStat.run(jockeys[i], period, '2026-05-01', today, '', '', dist, st, w, s2, t3, f4, Math.max(0, st-w-s2-t3-f4), Number((w/st*100).toFixed(1)), Number(((w+s2)/st*100).toFixed(1)), Number(((w+s2+t3)/st*100).toFixed(1)), 88+i*4, 77+i*3, nowIso());
        }
        for (const course of [{surface:'芝', distance:1600},{surface:'芝',distance:2000},{surface:'ダート',distance:1200},{surface:'ダート',distance:1800}]) {
          const st = Math.max(10, Math.floor(baseStarts / (period==='lifetime'?22:10)) + i);
          const w = Math.max(1, Math.floor(st * (course.surface==='芝'?0.14:0.11) + i%3));
          const s2 = Math.max(1, Math.floor(st * 0.11));
          const t3 = Math.max(1, Math.floor(st * 0.10));
          const f4 = Math.max(0, Math.floor(st * 0.08));
          insertJockeyStat.run(jockeys[i], period, '2026-05-01', today, '', course.surface, course.distance, st, w, s2, t3, f4, Math.max(0, st-w-s2-t3-f4), Number((w/st*100).toFixed(1)), Number(((w+s2)/st*100).toFixed(1)), Number(((w+s2+t3)/st*100).toFixed(1)), 91+i*3, 82+i*2, nowIso());
        }
        for (const venue of ['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉']) {
          const st = Math.max(12, Math.floor(baseStarts / (period==='lifetime'?20:9)) + i);
          const w = Math.max(1, Math.floor(st * (venue==='東京'?0.15:0.11) + i%2));
          const s2 = Math.max(1, Math.floor(st * 0.10));
          const t3 = Math.max(1, Math.floor(st * 0.09));
          const f4 = Math.max(0, Math.floor(st * 0.07));
          insertJockeyStat.run(jockeys[i], period, '2026-05-01', today, venue, '', null, st, w, s2, t3, f4, Math.max(0, st-w-s2-t3-f4), Number((w/st*100).toFixed(1)), Number(((w+s2)/st*100).toFixed(1)), Number(((w+s2+t3)/st*100).toFixed(1)), 93+i*2, 84+i*2, nowIso());
        }
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
        ['距離実績あり','past_run','{"type":"distance_experience"}',1,1,1],
        ['同場所実績あり','past_run','{"type":"same_venue_top3"}',2,1,2],
        ['右回り/左回り実績あり','past_run','{"type":"same_turn_top3"}',1,1,3],
        ['小回りコース実績あり','past_run','{"type":"small_course_top3"}',1,1,4],
        ['大箱/外回り系コース実績あり','past_run','{"type":"big_outer_top3"}',1,1,5],
        ['前走上がり3位以内','past_run','{"type":"last_run_agari_top3"}',1,1,6],
        ['騎手直近1ヶ月勝率15%以上','jockey','{"type":"recent_win_rate","min":15}',1,1,7],
        ['重賞5着以内あり','past_run','{"type":"graded_top5"}',1,1,8],
        ['前走距離延長で3着以内','past_run','{"type":"last_run_distance_up_top3"}',1,1,9],
        ['前走距離短縮で3着以内','past_run','{"type":"last_run_distance_down_top3"}',1,1,10],
        ['同条件実績あり','past_run','{"type":"same_condition_top3"}',2,1,11],
        ['自己条件レース','race_class','{"type":"self_condition"}',3,1,12],
        ['ハンデ戦斤量補正','weight','{"type":"handicap_light"}',0,1,13],
        ['距離延長が合いそう（手動判断）','manual_note','{"type":"distance_up_note"}',0,1,14],
        ['距離短縮が合いそう（手動判断）','manual_note','{"type":"distance_down_note"}',0,1,15],
        ['脚質バイアス一致','bias','{"type":"style_bias"}',1,1,16],
        ['期待値あり','odds','{"type":"value"}',1,1,17]
      ];
      for (const r of rules) insertRule.run(...r, nowIso());
    }
  });
  tx();
  return { count: races.length, message: `sample data fetched (${mode}) ${dateFrom||''} ${dateTo||''}` };
}
