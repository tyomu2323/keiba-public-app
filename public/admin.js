let token=localStorage.getItem('adminToken')||'';let races=[];
function auth(){return {Authorization:'Bearer '+token,'Content-Type':'application/json'}}
async function login(){const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:user.value,password:pass.value})});const j=await res.json();if(j.token){token=j.token;localStorage.setItem('adminToken',token);showAdmin();}else loginMsg.textContent=j.error||'失敗';}
function showAdmin(){document.querySelectorAll('.admin-only').forEach(e=>e.classList.remove('hidden'));loginBox.classList.add('hidden');loadRaces();loadLogs();loadWatchHorses();loadScoringRules();}
async function manualFetch(){fetchResult.textContent='取得中...';const res=await fetch('/api/admin/fetch',{method:'POST',headers:auth(),body:JSON.stringify({mode:'manual',target:target.value,dateFrom:dateFrom.value,dateTo:dateTo.value})});fetchResult.textContent=JSON.stringify(await res.json(),null,2);loadRaces();loadLogs();loadWatchHorses();loadScoringRules();}
async function loadRaces(){const j=await (await fetch('/api/races')).json();races=j.races;raceSelect.innerHTML=races.map(r=>`<option value="${r.id}">${r.date} ${r.venue}${r.race_no}R ${r.name}</option>`).join('');raceSelect.onchange=loadHorses;loadHorses();renderBiasVenueButtons();}
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
 same_distance_top3:{name:'同距離3着以内',category:'past_run',condition:{type:'same_distance_top3'},score:8},
 same_venue_top3:{name:'同開催場3着以内',category:'past_run',condition:{type:'same_venue_top3'},score:6},
 workout_top15:{name:'最終追い切り上位15%',category:'workout',condition:{type:'top15'},score:10},
 workout_top25:{name:'最終追い切り上位25%',category:'workout',condition:{type:'top25'},score:6},
 workout_best_like:{name:'馬なり上位15%',category:'workout',condition:{type:'best_like'},score:12},
 jockey_recent:{name:'騎手直近1ヶ月勝率15%以上',category:'jockey',condition:{type:'recent_win_rate',min:15},score:5},
 good_frame:{name:'好走枠',category:'trend',condition:{type:'good_frame',min:5},score:4},
 style_bias:{name:'脚質バイアス一致',category:'bias',condition:{type:'style_bias'},score:5},
 inside_bias:{name:'内有利バイアス',category:'bias',condition:{type:'inside_bias'},score:3},
 outside_bias:{name:'外有利バイアス',category:'bias',condition:{type:'outside_bias'},score:3},
 odds_value:{name:'期待値あり',category:'odds',condition:{type:'value'},score:5}
};
function applyRuleTemplate(){const t=templates[ruleTemplate.value]; if(!t)return; ruleName.value=t.name; ruleCategory.value=t.category; ruleCondition.value=JSON.stringify(t.condition); ruleScore.value=t.score;}
async function saveScoringRule(){try{JSON.parse(ruleCondition.value||'{}')}catch(e){ruleMsg.textContent='JSONの形が間違っています';return} const body={name:ruleName.value,category:ruleCategory.value,condition_json:ruleCondition.value,score:+ruleScore.value,enabled:1};const res=await fetch('/api/admin/scoring-rules',{method:'POST',headers:auth(),body:JSON.stringify(body)});ruleMsg.textContent=JSON.stringify(await res.json());loadScoringRules();}
async function loadScoringRules(){const res=await fetch('/api/admin/scoring-rules',{headers:auth()});const j=await res.json();ruleList.innerHTML=(j.rules||[]).map(r=>`<div class="rec rule-row"><b>${r.enabled?'ON':'OFF'} ${r.name}</b><div class="row"><input id="rn${r.id}" value="${String(r.name).replaceAll('\"','&quot;')}"><input id="rc${r.id}" value="${r.category}"><input id="rs${r.id}" type="number" value="${r.score}"></div><input id="rj${r.id}" value='${String(r.condition_json||'{}').replaceAll("'",'&#39;')}'><p class="muted">点数はここで編集できます。変更後「保存」を押してください。</p><button onclick="updateRule(${r.id})">保存</button><button onclick="toggleRule(${r.id})">ON/OFF</button><button onclick="deleteRule(${r.id})">削除</button></div>`).join('')||'ルールなし';}
async function updateRule(id){let condition=document.getElementById('rj'+id).value;try{JSON.parse(condition||'{}')}catch(e){alert('JSONの形が間違っています');return}const body={name:document.getElementById('rn'+id).value,category:document.getElementById('rc'+id).value,condition_json:condition,score:+document.getElementById('rs'+id).value,enabled:1};await fetch('/api/admin/scoring-rules/'+id,{method:'PUT',headers:auth(),body:JSON.stringify(body)});loadScoringRules();}
async function toggleRule(id){await fetch('/api/admin/scoring-rules/'+id+'/toggle',{method:'POST',headers:auth()});loadScoringRules();}
async function deleteRule(id){await fetch('/api/admin/scoring-rules/'+id,{method:'DELETE',headers:auth()});loadScoringRules();}
setTimeout(()=>{try{applyRuleTemplate()}catch{}},200);
