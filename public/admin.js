let token=localStorage.getItem('adminToken')||'';let races=[];
function auth(){return {Authorization:'Bearer '+token,'Content-Type':'application/json'}}
async function login(){const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:user.value,password:pass.value})});const j=await res.json();if(j.token){token=j.token;localStorage.setItem('adminToken',token);showAdmin();}else loginMsg.textContent=j.error||'失敗';}
function showAdmin(){document.querySelectorAll('.admin-only').forEach(e=>e.classList.remove('hidden'));loginBox.classList.add('hidden');loadRaces();loadLogs();loadWatchHorses();loadScoringRules();}
async function manualFetch(){fetchResult.textContent='取得中...';const res=await fetch('/api/admin/fetch',{method:'POST',headers:auth(),body:JSON.stringify({mode:'manual',target:target.value,dateFrom:dateFrom.value,dateTo:dateTo.value})});fetchResult.textContent=JSON.stringify(await res.json(),null,2);loadRaces();loadLogs();loadWatchHorses();loadScoringRules();}
async function loadRaces(){const j=await (await fetch('/api/races')).json();races=j.races;raceSelect.innerHTML=races.map(r=>`<option value="${r.id}">${r.date} ${r.venue}${r.race_no}R ${r.name}</option>`).join('');workoutRaceSelect.innerHTML=raceSelect.innerHTML;raceSelect.onchange=loadHorses;loadHorses();renderBiasVenueButtons();}
function renderBiasVenueButtons(){const venues=[...new Set(races.map(r=>r.venue))];biasVenueButtons.innerHTML=venues.map(v=>`<button onclick="setBiasVenue('${v}')">${v}</button>`).join('');if(venues.length&&!biasVenue.value)biasVenue.value=venues[0];if(races[0]&&!biasDate.value)biasDate.value=races[0].date;}
function setBiasVenue(v){biasVenue.value=v;}
async function loadHorses(){if(!raceSelect.value)return;const d=await (await fetch('/api/races/'+encodeURIComponent(raceSelect.value))).json();horseSelect.innerHTML=d.entries.map(e=>`<option value="${e.horse_id}">${e.frame_no}枠 ${e.horse_no}番 ${e.name} / ${e.running_style||'脚質未入力'}</option>`).join('');}
async function saveRecommendation(){const body={race_id:raceSelect.value,horse_id:horseSelect.value,mark:mark.value,confidence:+confidence.value,reason:reason.value,bet_note:betNote.value,add_score:+addScore.value};const res=await fetch('/api/admin/recommendations',{method:'POST',headers:auth(),body:JSON.stringify(body)});recMsg.textContent=JSON.stringify(await res.json());}
async function saveWatchHorse(){const body={horse_name:watchHorseName.value,alert_condition:watchMark.value,note:watchNote.value};const res=await fetch('/api/admin/watch-horses',{method:'POST',headers:auth(),body:JSON.stringify(body)});watchMsg.textContent=JSON.stringify(await res.json());watchHorseName.value='';watchNote.value='';loadWatchHorses();loadScoringRules();}
async function loadWatchHorses(){const j=await (await fetch('/api/watch-horses')).json();watchList.innerHTML=(j.watch_horses||[]).map(r=>`<div class="rec"><div class="mark">${r.alert_condition||'注目'} ${r.horse_name}</div>${r.race_id?`<b>出走中：${r.venue}${r.race_no}R ${r.race_name}</b>`:'<b>出走予定なし</b>'}<p>${r.note||''}</p></div>`).join('')||'登録馬はまだありません。';}
async function saveBias(){const body={date:biasDate.value,venue:biasVenue.value,surface:biasSurface.value,inside:+inside.value||0,outside:+outside.value||0,front:+front.value||0,stalker:+stalker.value||0,closer:+closer.value||0,deep_closer:+deepCloser.value||0,comment:biasComment.value};const res=await fetch('/api/admin/biases',{method:'POST',headers:auth(),body:JSON.stringify(body)});biasMsg.textContent=JSON.stringify(await res.json());}
async function loadLogs(){const res=await fetch('/api/admin/logs',{headers:auth()});logs.textContent=JSON.stringify(await res.json(),null,2)}
if(token)showAdmin();
const templates={
 distance_experience:{name:'距離実績あり',category:'past_run',condition:{type:'distance_experience'},score:1},
 same_venue_top3:{name:'同場所実績あり',category:'past_run',condition:{type:'same_venue_top3'},score:2},
 same_turn_top3:{name:'右回り/左回り実績あり',category:'past_run',condition:{type:'same_turn_top3'},score:1},
 small_course_top3:{name:'小回りコース実績あり',category:'past_run',condition:{type:'small_course_top3'},score:1},
 big_outer_top3:{name:'大箱/外回り系コース実績あり',category:'past_run',condition:{type:'big_outer_top3'},score:1},
 last_run_agari_top3:{name:'前走上がり3位以内',category:'past_run',condition:{type:'last_run_agari_top3'},score:1},
 jockey_recent:{name:'騎手直近1ヶ月勝率15%以上',category:'jockey',condition:{type:'recent_win_rate',min:15},score:1},
 graded_top5:{name:'重賞5着以内あり',category:'past_run',condition:{type:'graded_top5'},score:1},
 last_run_distance_up_top3:{name:'前走距離延長で3着以内',category:'past_run',condition:{type:'last_run_distance_up_top3'},score:1},
 last_run_distance_down_top3:{name:'前走距離短縮で3着以内',category:'past_run',condition:{type:'last_run_distance_down_top3'},score:1},
 same_condition_top3:{name:'同条件実績あり',category:'past_run',condition:{type:'same_condition_top3'},score:2},
 self_condition:{name:'自己条件レース',category:'race_class',condition:{type:'self_condition'},score:3},
 handicap_light:{name:'斤量補正（全レース適用）',category:'weight',condition:{type:'handicap_light'},score:0},
 distance_up_note:{name:'距離延長が合いそう（手動判断）',category:'manual_note',condition:{type:'distance_up_note'},score:0},
 distance_down_note:{name:'距離短縮が合いそう（手動判断）',category:'manual_note',condition:{type:'distance_down_note'},score:0},
 style_bias:{name:'脚質バイアス一致',category:'bias',condition:{type:'style_bias'},score:1},
 odds_value:{name:'期待値あり',category:'odds',condition:{type:'value'},score:1}
};
function applyRuleTemplate(){const t=templates[ruleTemplate.value]; if(!t)return; ruleName.value=t.name; ruleCategory.value=t.category; ruleCondition.value=JSON.stringify(t.condition); ruleScore.value=t.score;}
async function saveScoringRule(){try{JSON.parse(ruleCondition.value||'{}')}catch(e){ruleMsg.textContent='JSONの形が間違っています';return} const body={name:ruleName.value,category:ruleCategory.value,condition_json:ruleCondition.value,score:+ruleScore.value,enabled:1};const res=await fetch('/api/admin/scoring-rules',{method:'POST',headers:auth(),body:JSON.stringify(body)});ruleMsg.textContent=JSON.stringify(await res.json());loadScoringRules();}
async function loadScoringRules(){const res=await fetch('/api/admin/scoring-rules',{headers:auth()});const j=await res.json();ruleList.innerHTML=(j.rules||[]).map(r=>`<div class="rec rule-row"><b>${r.enabled?'ON':'OFF'} ${r.name}</b><div class="row"><input id="rn${r.id}" value="${String(r.name).replaceAll('\"','&quot;')}"><input id="rc${r.id}" value="${r.category}"><input id="rs${r.id}" type="number" value="${r.score}"></div><input id="rj${r.id}" value='${String(r.condition_json||'{}').replaceAll("'",'&#39;')}'><p class="muted">点数はここで編集できます。変更後「保存」を押してください。</p><button onclick="updateRule(${r.id})">保存</button><button onclick="toggleRule(${r.id})">ON/OFF</button><button onclick="deleteRule(${r.id})">削除</button></div>`).join('')||'ルールなし';}
async function updateRule(id){let condition=document.getElementById('rj'+id).value;try{JSON.parse(condition||'{}')}catch(e){alert('JSONの形が間違っています');return}const body={name:document.getElementById('rn'+id).value,category:document.getElementById('rc'+id).value,condition_json:condition,score:+document.getElementById('rs'+id).value,enabled:1};await fetch('/api/admin/scoring-rules/'+id,{method:'PUT',headers:auth(),body:JSON.stringify(body)});loadScoringRules();}
async function toggleRule(id){await fetch('/api/admin/scoring-rules/'+id+'/toggle',{method:'POST',headers:auth()});loadScoringRules();}
async function deleteRule(id){await fetch('/api/admin/scoring-rules/'+id,{method:'DELETE',headers:auth()});loadScoringRules();}
setTimeout(()=>{try{applyRuleTemplate()}catch{}},200);


function adminHorseNoBadge(e){return `<span class="frame-badge frame-${Number(e.frame_no)||0}">${e.frame_no||'-'}</span><span class="horse-no frame-${Number(e.frame_no)||0}">${e.horse_no||'-'}</span>`}
function groupWorkouts(workouts){const g={};for(const w of workouts||[]){if(!g[w.horse_id])g[w.horse_id]=[];g[w.horse_id].push(w)}return g;}
function adminLap(w){return w.lap_text || [w.total_time,w.furlong_6,w.furlong_5,w.furlong_4,w.furlong_3,w.furlong_2,w.furlong_1].filter(v=>v!==null&&v!==undefined&&v!=='').join('-')}
async function loadWorkoutScoring(){
  if(!workoutRaceSelect.value){workoutScoring.innerHTML='レースがありません';return;}
  workoutScoring.innerHTML='読み込み中...';
  const d=await (await fetch('/api/admin/races/'+encodeURIComponent(workoutRaceSelect.value)+'/workout-scoring',{headers:auth()})).json();
  const grouped=groupWorkouts(d.workouts||[]);
  workoutScoring.innerHTML=`<h3>${d.race.venue}${d.race.race_no}R ${d.race.name}</h3><p class="muted">各馬の追い切りを見て、調教タイムごとに感覚評価を保存します。保存後は該当行だけ更新するので画面が固まりにくくなっています。</p>`+
    (d.entries||[]).map(e=>{
      const list=(grouped[e.horse_id]||[]).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      const currentTotal=Number(e.workout_manual_score||0);
      const distanceTotal=Number(e.distance_fit_manual_score||0);
      return `<div class="rec workout-admin-card" id="wcard-${e.horse_id}"><h3>${adminHorseNoBadge(e)} ${e.name} <span class="score-pill" id="wtotal-${e.horse_id}">追切手動 ${currentTotal}</span><span class="score-pill" id="dtotal-${e.horse_id}">距離適性手動 ${distanceTotal}</span></h3><div class="horse-manual-panel"><b>距離延長/短縮の目視判断</b><span class="muted">馬ごとに保存。基準0点。</span><div class="row compact-row"><span>距離延長が合いそう</span>${[0,1,2,3].map(n=>`<button class="mini-btn ${n===Number(e.distance_up_fit_score||0)?'active':''}" data-distance-horse="${e.horse_id}" data-distance-label="distance_up_fit" data-score="${n}" onclick="saveDistanceFitManualScore('${d.race.id}','${e.horse_id}','distance_up_fit',${n},'距離延長が合いそう')">${n>0?'+':''}${n}</button>`).join('')}</div><div class="row compact-row"><span>距離短縮が合いそう</span>${[0,1,2,3].map(n=>`<button class="mini-btn ${n===Number(e.distance_down_fit_score||0)?'active':''}" data-distance-horse="${e.horse_id}" data-distance-label="distance_down_fit" data-score="${n}" onclick="saveDistanceFitManualScore('${d.race.id}','${e.horse_id}','distance_down_fit',${n},'距離短縮が合いそう')">${n>0?'+':''}${n}</button>`).join('')}<span class="save-state" id="dstate-${e.horse_id}"></span></div></div>${list.length?`<div class="table-wrap"><table class="compact"><thead><tr><th>日付</th><th>調教コース</th><th>強度</th><th>タイム</th><th>評価</th><th>手動加点</th><th>メモ</th></tr></thead><tbody>${list.map(w=>{
        const wc=Number(w.manual_score||0);
        const rowId=`wrow-${w.id}`;
        return `<tr id="${rowId}"><td>${w.date||''}</td><td>${w.course||''}</td><td>${w.intensity||''}</td><td><b>${adminLap(w)}</b></td><td>${w.top15_flag?'上位15%':w.top25_flag?'上位25%':''}</td><td>${[-3,-2,-1,0,1,2,3,4,5].map(n=>`<button class="mini-btn ${n===wc?'active':''}" data-workout-id="${w.id}" data-score="${n}" onclick="saveWorkoutManualScore('${d.race.id}','${e.horse_id}',${w.id},${n},'${String(e.name).replaceAll("'","\\'")}')">${n>0?'+':''}${n}</button>`).join('')}<span class="save-state" id="wstate-${w.id}"></span></td><td><input class="workout-memo" id="wmemo-${w.id}" placeholder="動き・気配メモ" value="${String(w.manual_reason||'').replaceAll('"','&quot;')}"></td></tr>`
      }).join('')}</tbody></table></div>`:'<p class="muted">追い切りデータなし</p>'}</div>`
    }).join('');
}
async function saveWorkoutManualScore(raceId,horseId,workoutId,score,horseName){
  const state=document.getElementById('wstate-'+workoutId);
  if(state) state.textContent='保存中...';
  const memo=document.getElementById('wmemo-'+workoutId)?.value || `追い切り感覚評価：${horseName}`;
  const res=await fetch('/api/admin/manual-scores',{method:'POST',headers:auth(),body:JSON.stringify({race_id:raceId,horse_id:horseId,category:'workout_manual',label:`workout:${workoutId}`,score,reason:memo})});
  const j=await res.json();
  document.querySelectorAll(`[data-workout-id="${workoutId}"]`).forEach(btn=>btn.classList.toggle('active', Number(btn.dataset.score)===Number(score)));
  const total=document.getElementById('wtotal-'+horseId);
  if(total && j.workout_manual_total!==undefined) total.textContent=`追切手動 ${j.workout_manual_total}`;
  if(state){state.textContent=j.ok?'保存済み':'エラー'; setTimeout(()=>{state.textContent=''},1200)}
}

async function saveDistanceFitManualScore(raceId,horseId,label,score,reason){
  const state=document.getElementById('dstate-'+horseId);
  if(state) state.textContent='保存中...';
  const res=await fetch('/api/admin/manual-scores',{method:'POST',headers:auth(),body:JSON.stringify({race_id:raceId,horse_id:horseId,category:'distance_fit_manual',label,score,reason})});
  const j=await res.json();
  document.querySelectorAll(`[data-distance-horse="${horseId}"][data-distance-label="${label}"]`).forEach(btn=>btn.classList.toggle('active', Number(btn.dataset.score)===Number(score)));
  const total=document.getElementById('dtotal-'+horseId);
  if(total && j.distance_fit_manual_total!==undefined) total.textContent=`距離適性手動 ${j.distance_fit_manual_total}`;
  if(state){state.textContent=j.ok?'保存済み':'エラー'; setTimeout(()=>{state.textContent=''},1200)}
}
