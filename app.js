async function api(p){return (await fetch(p)).json()}
function pct(p){return p<=0.15?'A 上位15%':p<=0.25?'B 上位25%':'C'}
function byVenue(races){
  const grouped={};
  for(const r of races){
    if(!grouped[r.venue]) grouped[r.venue]=[];
    grouped[r.venue].push(r);
  }
  return grouped;
}
function raceButton(r){
  const label=`${r.race_no}R`;
  const meta=`${r.name || ''}${r.surface?` / ${r.surface}${r.distance}m`:''}`;
  return `<button class="race-btn" onclick="detail('${r.id}')"><span>${label}</span><small>${meta}</small></button>`;
}
function blankButton(no){return `<button class="race-btn disabled" disabled><span>${no}R</span><small>未取得</small></button>`}
async function load(){
 const recs=await api('/api/recommendations');
 document.getElementById('recs').innerHTML = recs.recommendations.length?recs.recommendations.map(r=>`<div class="rec"><div class="mark">${r.mark} ${r.horse_name}</div><b>${r.venue}${r.race_no}R ${r.race_name}</b><p>信頼度 ${'★'.repeat(r.confidence)}</p><p>${r.reason}</p><p><span class="pill">買い方</span>${r.bet_note||'未入力'}</p></div>`).join(''):'まだ登録がありません。';
 const races=await api('/api/races');
 const grouped=byVenue(races.races);
 const html=Object.entries(grouped).map(([venue, list])=>{
   const byNo=Object.fromEntries(list.map(r=>[r.race_no,r]));
   const buttons=[];
   for(let i=1;i<=12;i++) buttons.push(byNo[i]?raceButton(byNo[i]):blankButton(i));
   const date=list[0]?.date||'';
   return `<div class="venue-card"><h3>${venue}<span>${date}</span></h3><div class="race-grid">${buttons.join('')}</div></div>`;
 }).join('');
 document.getElementById('raceBoard').innerHTML=html || 'レースデータがありません。管理画面から取得してください。';
}
async function detail(id){
 const d=await api('/api/races/'+encodeURIComponent(id));
 const workoutMap=Object.fromEntries(d.workouts.map(w=>[w.horse_id,w]));
 document.getElementById('detail').innerHTML=`<h3>${d.race.venue}${d.race.race_no}R ${d.race.name}</h3><p class="muted">${d.race.date} / ${d.race.surface}${d.race.distance}m / 馬場 ${d.race.going||'-'}</p>${d.bias?`<p><span class="pill">バイアス</span>内${d.bias.inside} 外${d.bias.outside} 逃げ${d.bias.front} 先行${d.bias.stalker} 差し${d.bias.closer}<br>${d.bias.comment}</p>`:''}<div class="table-wrap"><table><thead><tr><th>印</th><th>馬</th><th>騎手</th><th>追切</th><th>理論</th><th>実オッズ</th><th>理由</th></tr></thead><tbody>${d.entries.map(e=>{const w=workoutMap[e.horse_id];return `<tr><td>${e.mark||''}</td><td>${e.horse_no}. ${e.name}</td><td>${e.jockey}</td><td>${w?`${w.course} ${w.lap_text} ${w.intensity} ${pct(w.percentile)}`:''}</td><td>${e.theoretical_odds||''}</td><td>${e.actual_odds||''}</td><td>${e.rec_reason||''}</td></tr>`}).join('')}</tbody></table></div>`;
 document.getElementById('race-detail-card').scrollIntoView({behavior:'smooth', block:'start'});
}
load();
