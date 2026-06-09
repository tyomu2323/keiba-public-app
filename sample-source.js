import { db, nowIso } from '../db.js';

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
        going: no % 4 === 0 ? '稍重' : '良'
      });
    }
  }

  const horses = [
    ['h001','リバーベッドスター'], ['h002','アクアブレイブ'], ['h003','モスグリーン'], ['h004','フォールライン'],
    ['h005','バイアスシーカー'], ['h006','オッズハンター'], ['h007','パドックライト'], ['h008','ターフログ']
  ];

  const insertRace = db.prepare('INSERT OR REPLACE INTO races VALUES (@id,@date,@venue,@race_no,@name,@surface,@distance,@going,@updated_at)');
  const insertHorse = db.prepare('INSERT OR REPLACE INTO horses VALUES (?,?)');
  const insertEntry = db.prepare('INSERT OR REPLACE INTO entries VALUES (?,?,?,?,?,?,?,?,?)');
  const insertWorkout = db.prepare('INSERT INTO workouts (race_id,horse_id,date,course,lap_text,last_furlong,total_time,intensity,percentile) VALUES (?,?,?,?,?,?,?,?,?)');

  const tx = db.transaction(() => {
    for (const r of races) insertRace.run({ ...r, updated_at: nowIso() });
    for (const h of horses) insertHorse.run(...h);
    db.prepare('DELETE FROM workouts').run();
    for (const r of races) {
      const startIndex = (r.race_no + r.venue.length) % horses.length;
      for (let i = 0; i < 8; i++) {
        const h = horses[(startIndex + i) % horses.length];
        const horseNo = i + 1;
        const score = 88 - i * 5 + (r.race_no % 3);
        const theoretical = Number((3.0 + i * 1.6).toFixed(1));
        const actual = Number((theoretical * (i % 2 === 0 ? 1.45 : 0.86)).toFixed(1));
        insertEntry.run(r.id, h[0], Math.ceil(horseNo/2), horseNo, ['武豊','川田','ルメール','横山','坂井','戸崎','松山','岩田'][i], 'サンプル厩舎', score, theoretical, actual);
        const isTop = i === 0;
        insertWorkout.run(r.id, h[0], today, isTop ? 'CW' : '坂路', isTop ? '82.1-66.3-51.8-37.2-11.5' : `${(54+i/10).toFixed(1)}-38.${i}-24.${i}-12.${i}`, isTop ? 11.5 : Number(`12.${i}`), isTop ? 82.1 : Number((54+i/10).toFixed(1)), i % 3 === 0 ? '馬なり' : i % 3 === 1 ? '強め' : '一杯', i === 0 ? 0.12 : i === 1 ? 0.22 : 0.38);
      }
    }
  });
  tx();
  return { count: races.length, message: `sample data fetched (${mode}) ${dateFrom||''} ${dateTo||''}` };
}
