async function api(p){return (await fetch(p)).json()}
function pct(p){return Number(p)<=0.15?'A 上位15%':Number(p)<=0.25?'B 上位25%':'C'}
function byVenue(races){const grouped={};for(const r of races){if(!grouped[r.venue]) grouped[r.venue]=[];grouped[r.venue].push(r);}return grouped;}
function raceButton(r){const label=`${r.race_no}R`;const meta=`${r.name || ''}${r.surface?` / ${r.surface}${r.distance}m`:''}`;return `<button class="race-btn" onclick="detail('${r.id}')"><span>${label}</span><small>${meta}</small></button>`;}
function blankButton(no){return `<button class="race-btn disabled" disabled><span>${no}R</span><small>未取得</small></button>`}
function frameClass(n){return `frame-${Number(n)||0}`}
function horseNoBadge(e){return `<span class="frame-badge ${frameClass(e.frame_no)}">${e.frame_no||'-'}</span><span class="horse-no">${e.horse_no||'-'}</span>`}
function stars(n){return '★'.repeat(Number(n)||0)}
function styleBadge(s){const m={逃げ:'逃',先行:'先',差し:'差',追込:'追'};return `<span class="style-badge style-${s||'none'}">${m[s]||s||'-'}</span>`}
function scoreClass(v){v=Number(v)||0;return v>=25?'score-s':v>=15?'score-a':v>=5?'score-b':'score-c'}
let currentRaceDetail=null;
async function load(){
 const [recs,races,watch]=await Promise.all([api('/api/recommendations'),api('/api/races'),api('/api/watch-horses')]);
 document.getElementById('recs').innerHTML = recs.recommendations.length?recs.recommendations.map(r=>`<div class="rec"><div class="mark">${r.mark} ${r.horse_name}</div><b>${r.venue}${r.race_no}R ${r.race_name}</b><p>信頼度 ${stars(r.confidence)}</p><p>${r.reason}</p><p><span class="pill">買い方</span>${r.bet_note||'未入力'}</p></div>`).join(''):'まだ登録がありません。';
 const grouped=byVenue(races.races);
 const html=Object.entries(grouped).map(([venue, list])=>{const byNo=Object.fromEntries(list.map(r=>[r.race_no,r]));const buttons=[];for(let i=1;i<=12;i++) buttons.push(byNo[i]?raceButton(byNo[i]):blankButton(i));const date=list[0]?.date||'';return `<div class="venue-card"><h3>${venue}<span>${date}</span></h3><div class="race-grid">${buttons.join('')}</div></div>`;}).join('');
 document.getElementById('raceBoard').innerHTML=html || 'レースデータがありません。管理画面から取得してください。';
 renderWatchAlerts(watch.watch_horses||[]);
}
function renderWatchAlerts(rows){
 const active=rows.filter(r=>r.race_id);
 document.getElementById('watchAlerts').innerHTML=active.length?active.map(r=>`<div class="rec watch-rec"><div class="mark">${r.alert_condition||'注目'} ${r.horse_name}</div><b>${r.venue}${r.race_no}R ${r.race_name}</b><p>${r.note||''}</p><button onclick="detail('${r.race_id}')">レースを見る</button></div>`).join(''):'登録馬の出走はまだ見つかっていません。';
 if(active.length && !sessionStorage.getItem('watchPopupShown')){document.getElementById('watchModalBody').innerHTML=active.map(r=>`<p><b>${r.alert_condition||'注目'} ${r.horse_name}</b><br>${r.venue}${r.race_no}R ${r.race_name}<br>${r.note||''}</p>`).join('');document.getElementById('watchModal').classList.remove('hidden');sessionStorage.setItem('watchPopupShown','1');}
}
function closeWatchModal(){document.getElementById('watchModal').classList.add('hidden')}
function lapValue(w,key){const v=w[key];return v===null||v===undefined||v===''?'':Number(v).toFixed(1).replace(/\.0$/,'')}
function intensityGroup(i){return String(i||'').includes('馬なり')?'easy':'hard'}
function rankClasses(workouts, visible){
 const keys=['total_time','furlong_6','furlong_5','furlong_4','furlong_3','furlong_2','furlong_1'];
 const map={};
 for(const key of keys){
  for(const group of ['easy','hard']){
   const rows=visible.filter(w=>intensityGroup(w.intensity)===group && Number(w[key])>0).sort((a,b)=>Number(a[key])-Number(b[key]));
   rows.forEach((w,idx)=>{const p=(idx+1)/rows.length;map[`${w.id}:${key}`]=p<=0.15?(group==='easy'?'easy15':'hard15'):p<=0.25?(group==='easy'?'easy25':'hard25'):'';});
  }
 }
 return map;
}
function bestMarks(list){
 const keys=['total_time','furlong_6','furlong_5','furlong_4','furlong_3','furlong_2','furlong_1'];
 const best={};
 for(const key of keys){const vals=list.filter(w=>Number(w[key])>0).map(w=>Number(w[key])); if(vals.length) best[key]=Math.min(...vals)}
 const out={}; for(const w of list){for(const k of keys){if(best[k]!==undefined && Number(w[k])===best[k]) out[`${w.id}:${k}`]='🏆'}} return out;
}
function lapCell(w,key,rank,best){const v=lapValue(w,key); if(!v)return '<td class="muted">-</td>'; const cls=rank[`${w.id}:${key}`]||''; const mark=best[`${w.id}:${key}`]||''; return `<td class="lap ${cls}">${mark}<b>${v}</b></td>`}
function renderWorkoutTable(entries, workouts, mode){
 const grouped={};for(const w of workouts){if(!grouped[w.horse_id])grouped[w.horse_id]=[];grouped[w.horse_id].push(w)}
 const visibleAll=[];for(const e of entries){const list=(grouped[e.horse_id]||[]).sort((a,b)=>(b.date||'').localeCompare(a.date||''));visibleAll.push(...(mode==='final'?list.slice(0,1):list));}
 const rank=rankClasses(workouts, visibleAll);
 return `<div class="workout-legend"><span class="legend easy25">馬なり25%</span><span class="legend easy15">馬なり15%</span><span class="legend hard25">強め/一杯25%</span><span class="legend hard15">強め/一杯15%</span><span class="legend best">🏆 ベストタイム</span></div>`+
 `<div class="workout-cards">${entries.map(e=>{const list=(grouped[e.horse_id]||[]).sort((a,b)=>(b.date||'').localeCompare(a.date||''));const show=mode==='final'?list.slice(0,1):list;const best=bestMarks(list);return `<div class="horse-workout"><h4>${horseNoBadge(e)} ${e.name} <span>${styleBadge(e.running_style)}</span></h4>${show.length?`<div class="table-wrap"><table class="compact"><thead><tr><th>日付</th><th>コース</th><th>強度</th><th>全体</th><th>6F</th><th>5F</th><th>4F</th><th>3F</th><th>2F</th><th>1F</th><th>評価</th></tr></thead><tbody>${show.map(w=>`<tr><td>${w.date||''}</td><td>${w.course||''}</td><td>${w.intensity||''}</td>${lapCell(w,'total_time',rank,best)}${lapCell(w,'furlong_6',rank,best)}${lapCell(w,'furlong_5',rank,best)}${lapCell(w,'furlong_4',rank,best)}${lapCell(w,'furlong_3',rank,best)}${lapCell(w,'furlong_2',rank,best)}${lapCell(w,'furlong_1',rank,best)}<td>${pct(w.percentile)} / ${w.rank_in_race||'-'}位</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">追い切りデータなし</p>'}</div>`}).join('')}</div>`;
}
function renderScoreBreakdown(e, scores){
 const rows=(scores||[]).filter(s=>s.horse_id===e.horse_id);
 if(!rows.length && !Number(e.rec_add_score||0)) return '<span class="muted">加点なし</span>';
 const rec=Number(e.rec_add_score||0)?`<li><b>+${e.rec_add_score}</b> おすすめ加点：${e.rec_reason||''}</li>`:'';
 return `<details class="score-detail"><summary>内訳を見る</summary><ul>${rows.map(s=>`<li><b>${Number(s.score)>0?'+':''}${s.score}</b> ${s.rule_name}<br><span>${s.reason||''}</span></li>`).join('')}${rec}</ul></details>`;
}
function renderRaceDetail(mode='final'){
 const d=currentRaceDetail;if(!d)return;
 const workoutMap={};for(const w of d.workouts){if(!workoutMap[w.horse_id] || String(w.date||'') > String(workoutMap[w.horse_id].date||'')) workoutMap[w.horse_id]=w;}
 const entriesHtml=d.entries.map(e=>{const w=workoutMap[e.horse_id];const score=Number(e.score||0)+Number(e.rec_add_score||0);return `<tr><td class="mark-cell">${e.mark||''}</td><td>${horseNoBadge(e)}</td><td><b>${e.name}</b><br><span class="muted">${e.sex_age||''}</span></td><td>${styleBadge(e.running_style)}</td><td>${e.jockey||''}</td><td>${w?`${w.course} ${w.intensity}<br><span class="muted">${w.lap_text} / ${pct(w.percentile)}</span>`:''}</td><td><span class="score-pill ${scoreClass(score)}">${score}</span>${renderScoreBreakdown(e,d.scores)}</td><td>${e.theoretical_odds||''}</td><td>${e.actual_odds||''}</td><td>${e.rec_reason||''}</td></tr>`}).join('');
 document.getElementById('detail').innerHTML=`<h3>${d.race.venue}${d.race.race_no}R ${d.race.name}</h3><p class="muted">${d.race.date} / ${d.race.surface}${d.race.distance}m / 馬場 ${d.race.going||'-'}</p>${d.bias?`<p><span class="pill">${d.race.venue} ${d.race.surface} バイアス</span>内${d.bias.inside} 外${d.bias.outside} 逃げ${d.bias.front} 先行${d.bias.stalker} 差し${d.bias.closer} 追込${d.bias.deep_closer||0}<br>${d.bias.comment}</p>`:''}<div class="table-wrap"><table class="newspaper"><thead><tr><th>印</th><th>枠/馬</th><th>馬</th><th>脚質</th><th>騎手</th><th>最終追切</th><th>加点</th><th>理論</th><th>実オッズ</th><th>理由</th></tr></thead><tbody>${entriesHtml}</tbody></table></div><div class="workout-switch"><h3>追い切り</h3><button onclick="renderRaceDetail('final')" class="${mode==='final'?'active':''}">最終追い切り</button><button onclick="renderRaceDetail('all')" class="${mode==='all'?'active':''}">全追い切り</button></div>${renderWorkoutTable(d.entries,d.workouts,mode)}`;
}
async function detail(id){currentRaceDetail=await api('/api/races/'+encodeURIComponent(id));renderRaceDetail('final');document.getElementById('race-detail-card').scrollIntoView({behavior:'smooth', block:'start'});}
load();
