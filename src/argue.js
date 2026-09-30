(()=> {
'use strict';
const KEY='decisionLab.argue.v1';
const $=s=>document.querySelector(s);
const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-5);
const now=()=>Date.now();
const words=s=>String(s||'').toLowerCase().match(/[a-z0-9']+/g)||[];
const has=(s,arr)=>{const w=words(s);return arr.some(x=>w.includes(x))};
const sentences=s=>String(s||'').split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(x=>x.length>12);
const claims=s=>{const a=sentences(s);return a.length?a.slice(0,12):[String(s||'').trim()].filter(Boolean)};
const blank=()=>({decision:'',context:'',flaws:[],claims:[],thread:[],mode:'idle',turn:0});
let S=blank();
function load(){try{const x=JSON.parse(localStorage.getItem(KEY));if(x)S=Object.assign(blank(),x)}catch(e){}}
function save(){localStorage.setItem(KEY,JSON.stringify(S))}
function flaw(type,title,detail,question,severity){return{id:uid(),type:title?type:'general',title,detail,question,severity:severity||2,status:'open',replies:0,t:now()}}
function analyze(decision,context){
 const all=(decision+' '+context).trim(), f=[];
 const hasNums=/\b\d+(?:\.\d+)?\s*(?:%|k|m|hours?|days?|months?|years?|₹|\$|€|£)?\b/i.test(all);
 const alt=has(all,['instead','alternative','option','versus','vs','backup','compare','wait']);
 const evidence=has(all,['evidence','data','study','research','tested','experiment','benchmark','source','survey','history']);
 const success=has(all,['success','metric','measure','target','goal','threshold','kpi','outcome']);
 const time=has(all,['today','tomorrow','week','month','year','deadline','timeline','later','horizon']);
 const risk=has(all,['risk','downside','failure','fail','worst','uncertain','uncertainty','probability']);
 const people=has(all,['team','family','partner','customer','client','employee','boss','investor','user','people']);
 const absolute=has(all,['always','never','guaranteed','obvious','definitely','certainly','everyone','nobody','only']);
 const emotional=has(all,['feel','feels','hate','love','excited','scared','obvious','gut']);
 const sunk=has(all,['already','spent','invested','worked','built','paid','committed','years']);
 const causal=has(all,['because','therefore','causes','leads','results','means','will']);
 const irreversible=has(all,['quit','leave','move','sell','buy','launch','close','sign','hire','fire','dropout','drop-out','commit']);
 const price=has(all,['cost','price','budget','salary','revenue','profit','money','expense']);
 if(!decision.trim())f.push(flaw('frame','No decision statement','There is nothing precise enough to attack yet.','What exactly are you proposing to do?',3));
 if(decision.trim()&&!success)f.push(flaw('objective','Success is undefined','The choice is stated, but the criterion for calling it successful is missing.','What observable outcome would make you say this was the right decision?',3));
 if(!alt)f.push(flaw('alternatives','The option set may be artificially narrow','You gave me a preferred path without a serious comparison set. “Do nothing” or “wait” can be real alternatives.','What are the two strongest alternatives, including wait or do nothing?',3));
 if(!evidence)f.push(flaw('evidence','Key claims are under-evidenced','Important assertions are present, but the argument does not tell me which evidence supports them.','What is the strongest evidence for the single most important claim?',3));
 if(!hasNums)f.push(flaw('quantification','Important assumptions are not quantified','Ranges would reveal whether the conclusion depends on a fragile estimate.','Give me a low, likely and high estimate for the biggest uncertain variable.',2));
 if(!risk)f.push(flaw('downside','Downside analysis is missing','The desired outcome is visible, but failure modes and tail risk are not.','What is the most damaging plausible way this decision could fail?',3));
 if(!time)f.push(flaw('horizon','Time horizon is unclear','Benefits and costs can arrive at different times.','At what time horizon should this decision be judged?',2));
 if(!people)f.push(flaw('incentives','Stakeholder incentives are unspecified','Other people may be able to change the outcome. Their incentives can become the real bottleneck.','Who else can change the outcome and what do they want?',2));
 if(price&&!hasNums)f.push(flaw('resource','Resource feasibility is not explicit','Money, time, switching costs or capacity can invalidate a good theoretical choice.','What is the real budget and time you can commit?',2));
 if(causal&&!evidence)f.push(flaw('causality','A causal story may be doing too much work','Words like “because” and “will” turn assumptions into causal claims.','Which part still holds if the assumed causal link is weaker than expected?',3));
 if(absolute)f.push(flaw('certainty','The language is more certain than the evidence','Absolute claims carry a high burden of proof.','What observation would prove you wrong?',2));
 if(emotional)f.push(flaw('bias','Emotion may be mixing with factual reasoning','Emotion can matter, but it can also make confirming evidence feel stronger than disconfirming evidence.','Which part remains if the emotional appeal is removed?',2));
 if(sunk)f.push(flaw('sunk-cost','Past investment may be distorting the choice','Time or money already spent should matter only when it changes future consequences.','If you were starting from zero today, would you still choose this?',3));
 if(irreversible)f.push(flaw('reversibility','The cost of being wrong may be asymmetric','Irreversible actions deserve a higher evidence threshold than reversible experiments.','Can you turn this into a smaller reversible test first?',3));
 f.push(flaw('opportunity-cost','Opportunity cost is not explicit','Choosing this path consumes resources that cannot be used elsewhere.','What valuable alternative becomes harder if you choose this?',2));
 f.push(flaw('base-rate','Base rates are not established','This situation is being treated as unique without stating what normally happens in similar cases.','What usually happens in situations like this?',2));
 f.push(flaw('second-order','Second-order effects are unexplored','First-order benefits can create maintenance, incentives, dependencies or new decisions later.','What happens after the first consequence, and then after that?',2));
 f.push(flaw('comparison','The strongest opposing case has not been steelmanned','A conclusion is stronger when it survives the best argument against it.','What is the strongest case for doing the opposite?',3));
 return f;
}
function openFlaws(){return S.flaws.filter(f=>f.status==='open')}
function opening(){
 const top=openFlaws().slice().sort((a,b)=>b.severity-a.severity).slice(0,3);
 return 'I have your decision. I will not just say “good” or “bad”; I will try to break the reasoning.\n\nI found '+S.claims.length+' main claims and '+openFlaws().length+' pressure points.\n\nFirst attacks:\n1. '+(top[0]?top[0].title:'the objective')+' — '+(top[0]?top[0].question:'define success')+'\n2. '+(top[1]?top[1].title:'the evidence')+' — '+(top[1]?top[1].question:'show evidence')+'\n3. '+(top[2]?top[2].title:'the downside')+' — '+(top[2]?top[2].question:'show the failure mode')+'\n\nDefend your position. I will update the unresolved issues as we argue.';
}
function chooseFlaw(text){
 const w=words(text),open=openFlaws();if(!open.length)return null;
 let best=open[0],score=-1;
 open.forEach(f=>{const fw=words(f.title+' '+f.detail+' '+f.question),over=fw.filter(x=>w.includes(x)).length,s=over*2+f.severity-(f.replies||0)*.2;if(s>score){score=s;best=f}});
 return best;
}
function classify(text){
 const t=String(text||'').toLowerCase();
 if(/\b(yes|fair|true|you're right|you are right|good point|i agree)\b/.test(t))return'concede';
 if(/\b(no|wrong|disagree|false|incorrect|you miss)\b/.test(t))return'challenge';
 if(/\b(evidence|data|study|source|benchmark|tested|experiment|numbers?|percent)\b/.test(t)||/\d/.test(t))return'evidence';
 if(/\b(because|since|therefore|means|causes|leads|will)\b/.test(t))return'reason';
 if(/\?$/.test(String(text).trim()))return'question';
 return'response';
}
function reply(text){
 const f=chooseFlaw(text),kind=classify(text);
 if(f)f.replies=(f.replies||0)+1;
 if(f&&kind==='evidence'&&has(text,['source','study','data','tested','benchmark']))f.status='addressed';
 if(f&&kind==='concede')f.status='addressed';
 const open=openFlaws();
 if(kind==='evidence'&&f)return 'That is useful evidence against my objection to “'+f.title+'”. I will reduce that objection for now.\n\nI am still pushing on the boundary condition: '+(open[0]?open[0].question:'what evidence would still falsify the decision?');
 if(kind==='concede'&&f)return 'Good. That means we found a real pressure point. I will treat “'+f.title+'” as addressed and move on.\n\nNext: '+(open[0]?open[0].question:'give me one reason the decision could still fail.');
 if(kind==='challenge'&&f)return 'Then let us isolate the disagreement instead of arguing past each other. My specific objection is “'+f.title+'”. Tell me which premise is wrong, what evidence contradicts it, or why the trade-off is acceptable.';
 if(kind==='question')return 'My critique is conditional, not absolute. I am attacking the weakest unsupported assumption. Current unresolved issues: '+(open.slice(0,3).map(x=>x.title).join(', ')||'none')+'. Pick one and we can go deeper.';
 if(f)return 'I understand your response, but I am not dropping “'+f.title+'” yet because '+f.detail.toLowerCase()+'\n\nNext challenge: '+f.question+'\n\nAnswer that and I will move to a different unresolved issue rather than repeat myself.';
 return 'You have closed the current set of objections. Now give me one reason the decision could still fail. I will attack that next.';
}
function render(){
 if(!$('argueDecision'))return;
 $('argueDecision').value=S.decision;$('argueContext').value=S.context;
 $('argueModeBadge').textContent=S.mode==='active'?openFlaws().length+' unresolved':S.mode==='steelman'?'Steelman':'Ready';
 $('argueFlawCount').textContent=openFlaws().length+' open issues';
 $('argueFlaws').innerHTML=S.flaws.length?S.flaws.map(f=>'<div class="argue-flaw '+(f.status==='resolved'?'resolved':'')+'"><div class="argue-flaw-head"><span class="argue-type">'+esc(f.type)+'</span><span class="pill '+(f.severity>=3?'warn':'good')+'">'+(f.status==='resolved'?'addressed':f.severity>=3?'high pressure':'watch')+'</span></div><strong>'+esc(f.title)+'</strong><p>'+esc(f.detail)+'</p><div class="argue-question"><b>Bot challenge:</b> '+esc(f.question)+'</div><div class="footer-actions left"><button class="small" data-argue-flaw="'+f.id+'">Argue this</button><button class="small" data-argue-resolve="'+f.id+'">'+(f.status==='resolved'?'Reopen':'Mark addressed')+'</button></div></div>').join(''):'<div class="empty">Enter a decision and start the argument.</div>';
 $('argueThread').innerHTML=S.thread.map(m=>'<div class="argue-msg '+m.role+'"><div class="argue-msg-role">'+(m.role==='bot'?'Decision Lab':'You')+'</div><div class="argue-msg-body">'+esc(m.text).replace(/\n/g,'<br>')+'</div></div>').join('');$('argueThread').scrollTop=$('argueThread').scrollHeight;
 $('argueThreadMeta').textContent=S.thread.length+' turns';
 $('argueSuggestions').innerHTML=openFlaws().slice(0,3).map(f=>'<button class="argue-chip" data-argue-suggest="'+f.id+'">'+esc(f.question)+'</button>').join('');
 const top=openFlaws().slice().sort((a,b)=>b.severity-a.severity)[0];
 $('argueCounterTitle').textContent=top?top.title:'No major unresolved flaw';
 $('argueCounter').innerHTML=top?'<div class="trace-item">The strongest counterargument is conditional: if this assumption fails, your conclusion may weaken. '+esc(top.question)+'</div>':'<div class="trace-item">You have addressed the current objections. The next useful move is a falsification test.</div>';
}
function start(){
 const d=$('argueDecision').value.trim(),c=$('argueContext').value.trim();if(!d){$('argueDecision').focus();return}
 S=Object.assign(blank(),{decision:d,context:c,claims:claims(d+' '+c),flaws:analyze(d,c),thread:[],mode:'active',turn:0});
 S.thread.push({role:'bot',text:opening(),t:now()});save();render();
}
function send(text){
 text=String(text||'').trim();if(!text)return;
 if(!S.decision){S.decision=$('argueDecision').value.trim();S.context=$('argueContext').value.trim();S.claims=claims(S.decision+' '+S.context);S.flaws=analyze(S.decision,S.context);S.mode='active'}
 S.thread.push({role:'user',text,t:now()});S.turn++;S.thread.push({role:'bot',text:reply(text),t:now()});save();render();
}
function steelman(){
 if(!S.decision)start();
 if(!S.decision)return;
 S.mode='steelman';const best=S.claims.slice(0,3).join(' ');
 S.thread.push({role:'bot',text:'Steelman:\n\nHere is the strongest fair version of your case:\n\n“'+best+'”\n\nWhy it could work: the chosen action may fit your stated goal, exploit the upside you care about, and be worth the risk if the key assumptions hold.\n\nNow the attack: a strong steelman is not proof. The biggest unresolved assumption is '+(openFlaws()[0]?openFlaws()[0].title:'the missing success metric')+'. '+(openFlaws()[0]?openFlaws()[0].question:'What would falsify the decision?'),t:now()});save();render();
}
function stress(){if(!S.decision){start();if(!S.decision)return}const top=openFlaws().slice().sort((a,b)=>b.severity-a.severity).slice(0,4);S.thread.push({role:'bot',text:'Stress test:\n\nAssume your preferred outcome fails. The first failure points are:\n'+top.map((f,i)=>(i+1)+'. '+f.title+': '+f.question).join('\n')+'\n\nThen look one step further: what maintenance cost, incentive change, dependency, opportunity cost or external shock appears after the first consequence?',t:now()});save();render()}
function rebuild(){S.thread.push({role:'bot',text:'Rebuild protocol:\n\n1. State one measurable objective.\n2. List 2–3 serious alternatives including wait/do nothing.\n3. Give low / likely / high estimates for the key uncertainties.\n4. Identify the assumption whose failure would kill the plan.\n5. Design the smallest reversible test.\n6. Set a review date and a stop/continue rule.\n\nSend the revised decision and I will attack the new version.',t:now()});save();render()}
function importCurrent(){
 const options=Array.from(document.querySelectorAll('[data-oi]')).map(x=>x.value.trim()).filter(Boolean);
 const criteria=Array.from(document.querySelectorAll('.criterion-name')).map(x=>x.value.trim()).filter(Boolean);
 const d=$('decisionName')?.value.trim()||options.join(' vs '),c=[$('decisionContext')?.value.trim()||'',options.length?'Options: '+options.join(', '):'',criteria.length?'Criteria: '+criteria.join(', '):''].filter(Boolean).join('\n');
 $('argueDecision').value=d||'Current Decision Lab decision';$('argueContext').value=c;start();
}
function flawPrompt(id){const f=S.flaws.find(x=>x.id===id);if(!f)return;$('argueInput').value=f.question;$('argueInput').focus()}
document.addEventListener('click',e=>{
 if(e.target.closest('[data-tab="argue"]'))setTimeout(render,0);
 if(e.target.id==='argueStart')start();
 if(e.target.id==='argueSend'){$('argueSend').disabled=true;send($('argueInput').value);$('argueInput').value='';$('argueSend').disabled=false}
 if(e.target.id==='argueSteelman')steelman();
 if(e.target.id==='argueStress')stress();
 if(e.target.id==='argueRebuild')rebuild();
 if(e.target.id==='argueImportCurrent')importCurrent();
 if(e.target.id==='argueClear'){S=blank();save();render()}
 if(e.target.dataset.argueFlaw)flawPrompt(e.target.dataset.argueFlaw);
 if(e.target.dataset.argueSuggest)flawPrompt(e.target.dataset.argueSuggest);
 if(e.target.dataset.argueResolve){const f=S.flaws.find(x=>x.id===e.target.dataset.argueResolve);if(f)f.status=f.status==='resolved'?'open':'resolved';save();render()}
});
$('argueInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('argueSend').click()}});
load();render();
})();