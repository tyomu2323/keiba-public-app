async function api(p){return (await fetch(p)).json()}
function pct(p){return p<=0.15?'A 上位15%':p<=0.25?'B 上位25%':'C'}
function byVenue(races){const grouped={};for(const r of races){if(!grouped[r.venue]) grouped[r.venue]=[];grouped[r.venue].push(r);}return grouped;}
function raceButton(r){const label=`${r.race_no}R`;const meta=`${r.name || ''}${r.surface?` / ${r.surface}${r.distance}m`:''}`;return `<button class="race-btn" onclick="detail('${r.id}')"><span>${label}</span><small>${meta}</small></button>`;}
function blankButton(no){return `<button class="race-btn disabled" disabled><span>${no}R</span><small>未取得</small></button>`}
function frameClass(n){return `frame-${Number(n)||0}`}
function horseNoBadge(e){return `<span class="frame-badge ${frameClass(e.frame_no)}">${e.frame_no||'-'}</span><span class="horse-no">${e.horse_no||'-'}</span>`}
function stars(n){return '★'.repeat(Number(n)||0)}
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
function renderWorkoutTable(entries, workouts, mode){
 const grouped={};for(const w of workouts){if(!grouped[w.horse_id])grouped[w.horse_id]=[];grouped[w.horse_id].push(w)}
 return `<div class="table-wrap"><table><thead><tr><th>馬番</th><th>馬名</th><th>日付</th><th>コース</th><th>時計/ラップ</th><th>強度</th><th>評価</th></tr></thead><tbody>${entries.map(e=>{const list=(grouped[e.horse_id]||[]).sort((a,b)=>(b.date||'').localeCompare(a.date||''));const show=mode==='final'?list.slice(0,1):list;return show.length?show.map(w=>`<tr><td>${horseNoBadge(e)}</td><td>${e.name}</td><td>${w.date||''}</td><td>${w.course||''}</td><td>${w.lap_text||''}</td><td>${w.intensity||''}</td><td>${pct(w.percentile)} / ${w.rank_in_race||'-'}位</td></tr>`).join(''):`<tr><td>${horseNoBadge(e)}</td><td>${e.name}</td><td colspan="5">追い切りデータなし</td></tr>`}).join('')}</tbody></table></div>`;
}
function renderRaceDetail(mode='final'){
 const d=currentRaceDetail;if(!d)return;
 const workoutMap={};for(const w of d.workouts){if(!workoutMap[w.horse_id] || String(w.date||'') > String(workoutMap[w.horse_id].date||'')) workoutMap[w.horse_id]=w;}
 const entriesHtml=d.entries.map(e=>{const w=workoutMap[e.horse_id];return `<tr><td>${e.mark||''}</td><td>${horseNoBadge(e)}</td><td><b>${e.name}</b><br><span class="muted">${e.sex_age||''}</span></td><td>${e.running_style||'-'}</td><td>${e.jockey||''}</td><td>${w?`${w.course} ${w.lap_text} ${w.intensity} ${pct(w.percentile)}`:''}</td><td>${e.theoretical_odds||''}</td><td>${e.actual_odds||''}</td><td>${e.rec_reason||''}</td></tr>`}).join('');
 document.getElementById('detail').innerHTML=`<h3>${d.race.venue}${d.race.race_no}R ${d.race.name}</h3><p class="muted">${d.race.date} / ${d.race.surface}${d.race.distance}m / 馬場 ${d.race.going||'-'}</p>${d.bias?`<p><span class="pill">${d.race.venue} ${d.race.surface} バイアス</span>内${d.bias.inside} 外${d.bias.outside} 逃げ${d.bias.front} 先行${d.bias.stalker} 差し${d.bias.closer} 追込${d.bias.deep_closer||0}<br>${d.bias.comment}</p>`:''}<div class="table-wrap"><table><thead><tr><th>印</th><th>枠/馬</th><th>馬</th><th>脚質</th><th>騎手</th><th>最終追切</th><th>理論</th><th>実オッズ</th><th>理由</th></tr></thead><tbody>${entriesHtml}</tbody></table></div><div class="workout-switch"><h3>追い切り</h3><button onclick="renderRaceDetail('final')" class="${mode==='final'?'active':''}">最終追い切り</button><button onclick="renderRaceDetail('all')" class="${mode==='all'?'active':''}">全追い切り</button></div>${renderWorkoutTable(d.entries,d.workouts,mode)}`;
}
async function detail(id){currentRaceDetail=await api('/api/races/'+encodeURIComponent(id));renderRaceDetail('final');document.getElementById('race-detail-card').scrollIntoView({behavior:'smooth', block:'start'});}
load();
