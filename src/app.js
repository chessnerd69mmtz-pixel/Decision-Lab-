(() => {
'use strict';

const KEY='decisionLab.v3';
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-5);
const now=()=>Date.now();
const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const sigmoid=x=>1/(1+Math.exp(-x));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const sd=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)*(x-m))))};
const fmtPct=v=>Math.round(clamp(v,0,1)*100)+'%';
const fmtNum=v=>Number(v).toFixed(1);

const DOMAINS={
  general:{label:'General',criteria:['Value','Cost','Quality','Reliability','Flexibility']},
  purchase:{label:'Purchase',criteria:['Price','Quality','Reliability','Features','Resale value','Convenience']},
  career:{label:'Career',criteria:['Compensation','Growth','Learning','Stability','Work-life balance','Location','Team quality']},
  education:{label:'Education',criteria:['Academic quality','Career value','Cost','Location','Learning environment','Flexibility']},
  business:{label:'Business',criteria:['Market size','Revenue potential','Cost','Time to launch','Competition','Strategic fit','Risk']},
  technology:{label:'Technology',criteria:['Performance','Reliability','Maintainability','Developer experience','Cost','Scalability','Security']},
  project:{label:'Project',criteria:['Impact','Effort','Time','Risk','Learning value','Strategic fit']},
  housing:{label:'Housing',criteria:['Cost','Location','Space','Safety','Commute','Quality','Flexibility']},
  travel:{label:'Travel',criteria:['Cost','Experience','Travel time','Comfort','Safety','Flexibility','Convenience']},
  team:{label:'Team choice',criteria:['Skill fit','Reliability','Communication','Cost','Availability','Growth potential']},
  software:{label:'Software',criteria:['Price','Features','Performance','Reliability','Integration','Support','Security']},
  investment:{label:'Investment study',criteria:['Expected return','Downside risk','Liquidity','Time horizon','Diversification','Fees']}
};
const OBJECTIVES={
  expected:'Maximize expected value',
  risk:'Risk-adjusted / downside aware',
  regret:'Minimize expected regret',
  robust:'Maximize robustness',
  upside:'Maximize upside potential',
  efficient:'Value per resource'
};
const SYN={
 cost:['cost','price','budget','fee','fees','expense','affordability'],
 performance:['performance','speed','power','throughput'],
 reliability:['reliability','durability','stability','uptime','maintenance'],
 battery:['battery','runtime','endurance','efficiency'],
 portability:['portable','portability','weight','mobility','compact'],
 quality:['quality','build','materials','finish'],
 safety:['safety','security','risk','protection'],
 support:['support','service','warranty','help'],
 flexibility:['flexibility','adaptability','versatility','customization'],
 growth:['growth','learning','development','upside'],
 location:['location','distance','commute','proximity'],
 comfort:['comfort','ergonomic','convenience'],
 time:['time','speed','duration','deadline','hours'],
 impact:['impact','value','benefit','effect','importance'],
 risk:['risk','uncertainty','volatility','downside']
};

const emptyState=()=>({
 decision:{
  id:uid(),name:'',context:'',domain:'general',horizon:'medium',risk:'balanced',objective:'expected',
  options:[{id:uid(),name:'Option A',cost:0,time:0,risk:30},{id:uid(),name:'Option B',cost:0,time:0,risk:30},{id:uid(),name:'Option C',cost:0,time:0,risk:30}],
  criteria:[{id:uid(),name:'Value',direction:'higher',group:'general',values:[{low:55,mid:65,high:75},{low:45,mid:55,high:65},{low:50,mid:60,high:70}]}]
 },
 learning:{criteria:{},options:{},concepts:{},comparisons:[],outcomes:[],events:[],questionHistory:[],pairConflicts:[]},
 scenarios:[],
 tree:{root:'Decision tree',branches:[{name:'Success',prob:.6,value:80},{name:'Base case',prob:.3,value:30},{name:'Failure',prob:.1,value:-60}]},
 timeline:[{label:'Initial decision',month:0,option:0,multiplier:1,infoGain:0}],
 group:{members:[{id:uid(),name:'You',influence:1,weights:{}}]},
 negotiation:[],
 history:[],
 simulation:null,
 createdAt:now(),
 lastEvaluatedAt:0
});

let state=emptyState();

function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function load(){
 try{
  const x=JSON.parse(localStorage.getItem(KEY));
  if(x){state=Object.assign(emptyState(),x);state.decision=Object.assign(emptyState().decision,x.decision||{});state.learning=Object.assign(emptyState().learning,x.learning||{});state.tree=Object.assign(emptyState().tree,x.tree||{});state.group=Object.assign(emptyState().group,x.group||{});state.causal=Object.assign(emptyState().causal,x.causal||{});state.causal.nodes=x.causal?.nodes||state.causal.nodes;state.causal.edges=x.causal?.edges||state.causal.edges;state.history=x.history||[];state.scenarios=x.scenarios||[];state.timeline=x.timeline||[];state.negotiation=x.negotiation||[];}
 }catch(e){console.warn(e)}
}
function tokenise(s){return String(s||'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(Boolean)}
function hashWord(w){let h=2166136261;for(let i=0;i<w.length;i++){h^=w.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h)%64}
function vector(text){const v=new Float64Array(64),t=tokenise(text);t.forEach(w=>v[hashWord(w)]+=1);Object.entries(SYN).forEach(([c,ws])=>{if(t.some(x=>ws.includes(x)))v[hashWord('concept:'+c)]+=1.5});const n=Math.sqrt(v.reduce((s,x)=>s+x*x,0))||1;return Array.from(v,n=>n)}
function cosine(a,b){let d=0,aa=0,bb=0;for(let i=0;i<a.length;i++){d+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return d/(Math.sqrt(aa*bb)||1)}
function conceptKey(name){
 const t=tokenise(name);let best='general',score=0;
 Object.entries(SYN).forEach(([k,ws])=>{const s=t.filter(x=>ws.includes(x)).length;if(s>score){best=k;score=s}});
 return best;
}
function memoryPrior(name){
 const v=vector(name),items=Object.values(state.learning.concepts||{});let best=null,bs=0;
 items.forEach(m=>{const s=cosine(v,m.vector||[]);if(s>bs){bs=s;best=m}});
 return best&&bs>.35?{mean:best.mean,variance:best.variance,similarity:bs,label:best.label}:null;
}
function remember(name,signal,uncertainty=.4){
 const k=conceptKey(name),v=vector(name),m=state.learning.concepts[k];
 if(!m){state.learning.concepts[k]={label:name,vector:v,mean:signal,variance:uncertainty,count:1,last:now()};return}
 const r=1/Math.min(20,m.count+1);m.mean+=r*(signal-m.mean);m.variance=clamp(m.variance*(1-r*.5)+Math.abs(signal-m.mean)*.08,.03,1);m.count++;m.last=now();
}
function criterionLatent(ci){
 const id=state.decision.criteria[ci].id;
 if(!state.learning.criteria[id]){
  const p=memoryPrior(state.decision.criteria[ci].name);
  state.learning.criteria[id]={score:p?((p.mean-.5)*.5):0,variance:p?Math.max(.25,p.variance):.8,evidence:p?1:0};
 }
 return state.learning.criteria[id];
}
function optionLatent(oi){
 const id=state.decision.options[oi].id;
 if(!state.learning.options[id])state.learning.options[id]={score:0,variance:.9,evidence:0};
 return state.learning.options[id];
}
function pairUpdate(map,aid,bid,winner,strength){
 const A=map[aid]||{score:0,variance:1,evidence:0},B=map[bid]||{score:0,variance:1,evidence:0};
 const p=sigmoid(A.score-B.score),target=winner==='tie'?.5:(winner===aid?1:0),err=(target-p)*(strength||1);
 A.score+=.45*err;B.score-=.45*err;A.variance=clamp(A.variance*(1-.04*(strength||1)),.04,1.3);B.variance=clamp(B.variance*(1-.04*(strength||1)),.04,1.3);A.evidence++;B.evidence++;map[aid]=A;map[bid]=B;
}
function triMean(v){return (Number(v.low)+4*Number(v.mid)+Number(v.high))/6}
function triVar(v){return Math.max(.0001,Math.pow((Number(v.high)-Number(v.low))/6,2))}
function criterionMeans(){return state.decision.criteria.map(c=>c.values.map(triMean))}
function baseWeights(){
 const out=state.decision.criteria.map((c,i)=>{
  const l=criterionLatent(i),prior=memoryPrior(c.name);
  return Math.exp(clamp(l.score,-3,3))*(1+(prior?.similarity||0)*.08);
 });
 normalize(out);
 return correlationAdjust(out);
}
function correlationAdjust(w){
 const groups={};
 state.decision.criteria.forEach((c,i)=>{const g=c.group||'none';if(!groups[g])groups[g]=[];groups[g].push(i)});
 Object.values(groups).forEach(ix=>{if(ix.length>1){const f=1/Math.sqrt(ix.length);ix.forEach(i=>w[i]*=f)}});normalize(w);return w;
}
function normalize(a){const s=a.reduce((x,y)=>x+y,0)||1;a.forEach((_,i)=>a[i]/=s)}
function optionScore(oi,weights=baseWeights(),objective=state.decision.objective,scenario=null){
 const crit=state.decision.criteria,base=crit.map((c,ci)=>{
  const v=state.decision.criteria[ci].values[oi]||{low:50,mid:50,high:50};
  let x=triMean(v);if(c.direction==='lower')x=100-x;
  if(scenario?.criterionMultipliers?.[ci])x*=scenario.criterionMultipliers[ci];
  return clamp(x,0,100)
 });
 const unc=crit.map((c,ci)=>Math.sqrt(triVar(c.values[oi]||{low:50,mid:50,high:50})+criterionLatent(ci).variance*1200));
 const u=base.reduce((s,x,i)=>s+weights[i]*x,0);
 const risk=(state.decision.options[oi].risk||30);
 const sdTotal=Math.sqrt(mean(unc.map(x=>x*x)));
 const os=100*sigmoid(optionLatent(oi).score);
 const learned=.14*os;
 if(objective==='risk')return u*.86-risk*.22-sdTotal*.34+learned;
 if(objective==='regret')return 100-(Math.max(...state.decision.options.map((_,j)=>optionRawUtility(j,weights)))-u)+learned;
 if(objective==='robust'){const sim=quickRobustProbability(oi);return u*(.55+.45*sim)+learned}
 if(objective==='upside')return u+sdTotal*.45+learned;
 if(objective==='efficient'){const c=state.decision.options[oi].cost||0;return u/(1+c/Math.max(1,resourceScale()))+learned}
 return u+learned;
}
function optionRawUtility(oi,weights){return state.decision.criteria.reduce((s,c,ci)=>{let x=triMean(c.values[oi]);if(c.direction==='lower')x=100-x;return s+weights[ci]*x},0)}
function resourceScale(){return mean(state.decision.options.map(o=>Number(o.cost)||0))||100}
function rank(objective=state.decision.objective,scenario=null){
 const w=scenario?.weights?scenario.weights.slice():baseWeights();
 if(scenario?.weights)normalize(w);
 return state.decision.options.map((o,i)=>({index:i,name:o.name,score:optionScore(i,w,objective,scenario),raw:optionRawUtility(i,w)})).sort((a,b)=>b.score-a.score);
}
function paretoSet(){
 const m=state.decision.criteria.length,n=state.decision.options.length;
 const out=[];
 for(let i=0;i<n;i++){
  let dominated=false;
  for(let j=0;j<n;j++)if(i!==j){
   let ge=true,gt=false;
   for(let c=0;c<m;c++){let a=triMean(state.decision.criteria[c].values[i]);let b=triMean(state.decision.criteria[c].values[j]);if(state.decision.criteria[c].direction==='lower'){a=100-a;b=100-b}if(b<a-1e-8)ge=false;if(b>a+1e-8)gt=true}
   if(ge&&gt){dominated=true;break}
  }
  if(!dominated)out.push(i);
 }
 return out;
}
function simulate(runs=2500,scenario=null){
 const counts=state.decision.options.map(()=>0),scores=state.decision.options.map(()=>[]);
 for(let k=0;k<runs;k++){
  const w=baseWeights().map((x,i)=>Math.max(.0005,x*Math.exp(randn()*(criterionLatent(i).variance*.32))));
  normalize(w);
  const vals=state.decision.options.map((o,oi)=>{
   let u=state.decision.criteria.reduce((s,c,ci)=>{
    let v=c.values[oi]||{low:50,mid:50,high:50},x=triangular(v.low,v.mid,v.high);if(c.direction==='lower')x=100-x;if(scenario?.criterionMultipliers?.[ci])x*=scenario.criterionMultipliers[ci];return s+w[ci]*x;
   },0);
   u+=.12*100*sigmoid(optionLatent(oi).score);return u;
  });
  const mx=Math.max(...vals),win=vals.indexOf(mx);counts[win]++;vals.forEach((v,i)=>scores[i].push(v));
 }
 state.simulation={runs,counts,means:scores.map(mean),at:now()};return state.simulation;
}
function quickRobustProbability(oi){if(!state.simulation||state.simulation.runs<200)return .5;return state.simulation.counts[oi]/state.simulation.runs}
function randn(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function triangular(a,m,b){a=Number(a);m=Number(m);b=Number(b);const u=Math.random();if(b===a)return a;const p=(m-a)/(b-a);return u<p?a+Math.sqrt(u*(b-a)*(m-a)):b-Math.sqrt((1-u)*(b-a)*(b-m))}
function confidence(rows){if(rows.length<2)return .2;const gap=Math.max(0,rows[0].score-rows[1].score);const avgU=mean(state.decision.criteria.map((_,i)=>criterionLatent(i).variance));return clamp(.25+gap/80+(1-avgU)*.48,0,.97)}
function expectedRegret(rows){return rows.length<2?0:clamp((rows[0].score-mean(rows.slice(1).map(x=>rows[0].score-x.score)))/100,0,1)}
function sensitivity(){
 const base=baseWeights(),lead=rank()[0]?.name,arr=[];
 state.decision.criteria.forEach((c,i)=>{
  const hi=base.slice(),lo=base.slice();hi[i]*=1.6;lo[i]*=.55;normalize(hi);normalize(lo);
  const a=rank(state.decision.objective,{weights:hi})[0]?.name,b=rank(state.decision.objective,{weights:lo})[0]?.name;
  arr.push({name:c.name,flip:a!==lead||b!==lead,detail:(a!==lead||b!==lead)?'Leader changes when this weight is stressed.':'Leader survives a ±40% local weight shock.'});
 });
 return arr.sort((a,b)=>Number(b.flip)-Number(a.flip));
}
function consistency(){
 const comps=state.learning.comparisons||[];
 const rel=comps.filter(x=>x.type==='criterion');
 const conflicts=[];
 for(let a=0;a<state.decision.criteria.length;a++)for(let b=a+1;b<state.decision.criteria.length;b++){
  const ids=[state.decision.criteria[a].id,state.decision.criteria[b].id];
  const pair=rel.filter(x=>(x.a===ids[0]&&x.b===ids[1])||(x.a===ids[1]&&x.b===ids[0]));
  const wins=new Set(pair.map(x=>x.winner));
  if(wins.size>1)conflicts.push({a:state.decision.criteria[a].name,b:state.decision.criteria[b].name});
 }
 const trans=[];
 const r=rankCriteria();
 for(let i=0;i<r.length-2;i++)for(let j=i+1;j<r.length-1;j++)for(let k=j+1;k<r.length;k++){
  if(r[i].weight>r[j].weight&&r[j].weight>r[k].weight){}
 }
 return {score:clamp(1-conflicts.length/Math.max(1,rel.length),0,1),conflicts};
}
function rankCriteria(){return state.decision.criteria.map((c,i)=>({index:i,name:c.name,weight:baseWeights()[i]})).sort((a,b)=>b.weight-a.weight)}

function currentQuestion(){
 const seen=new Set((state.learning.questionHistory||[]).map(x=>x.key));
 const candidates=[];
 const w=baseWeights(),rows=rank();
 for(let i=0;i<state.decision.criteria.length;i++)for(let j=i+1;j<state.decision.criteria.length;j++){
  const a=criterionLatent(i),b=criterionLatent(j),p=sigmoid(a.score-b.score),amb=1-Math.abs(p-.5)*2,unc=(a.variance+b.variance)/2;
  const wi=w.slice(),wj=w.slice();wi[i]*=1.5;wj[j]*=1.5;normalize(wi);normalize(wj);
  const impact=Number(rank(state.decision.objective,{weights:wi})[0]?.name!==rows[0]?.name)+Number(rank(state.decision.objective,{weights:wj})[0]?.name!==rows[0]?.name);
  const key='c:'+i+':'+j;if(!seen.has(key))candidates.push({key,type:'criterion',a:i,b:j,score:amb*(.7+unc)+impact*.45,reason:'This pair is still ambiguous and could move the ranking.'});
 }
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const A=optionLatent(rows[i].index),B=optionLatent(rows[j].index),gap=Math.abs(rows[i].score-rows[j].score),unc=(A.variance+B.variance)/2,key='o:'+rows[i].index+':'+rows[j].index;
  if(!seen.has(key))candidates.push({key,type:'option',a:rows[i].index,b:rows[j].index,score:(1/(1+gap))*(.8+unc),reason:'These options are close enough that a direct preference could change their order.'});
 }
 if(!candidates.length)return null;
 return candidates.sort((a,b)=>b.score-a.score)[0];
}
function addComparison(q,winner){
 if(q.type==='criterion'){
  const aid=state.decision.criteria[q.a].id,bid=state.decision.criteria[q.b].id;pairUpdate(state.learning.criteria,aid,bid,winner==='a'?aid:winner==='b'?bid:'tie',1);
  remember(state.decision.criteria[q.a].name,winner==='a'?.7:winner==='b'?.3:.5,.35);remember(state.decision.criteria[q.b].name,winner==='b'?.7:winner==='a'?.3:.5,.35);
 } else {
  const aid=state.decision.options[q.a].id,bid=state.decision.options[q.b].id;pairUpdate(state.learning.options,aid,bid,winner==='a'?aid:winner==='b'?bid:'tie',1);
 }
 state.learning.comparisons.push({id:uid(),type:q.type,a:q.type==='criterion'?state.decision.criteria[q.a].id:state.decision.options[q.a].id,b:q.type==='criterion'?state.decision.criteria[q.b].id:state.decision.options[q.b].id,winner,t:now()});
 state.learning.questionHistory.push({key:q.key,t:now()});state.learning.events.push({type:'question',text:q.key,t:now()});save();renderAll();
}

function buildRowsHTML(){
 const n=state.decision.options.length;
 let h='';
 state.decision.criteria.forEach((c,ci)=>{
  h+='<div class="criterion-block"><div class="criterion-head"><div><input class="criterion-name" data-ci="'+ci+'" value="'+esc(c.name)+'"><div class="criterion-meta"><select data-direction="'+ci+'"><option value="higher" '+(c.direction==='higher'?'selected':'')+'>Higher is better</option><option value="lower" '+(c.direction==='lower'?'selected':'')+'>Lower is better</option></select><input data-group="'+ci+'" value="'+esc(c.group||'general')+'" placeholder="correlation group"></div></div><button class="icon-btn" data-remove-criterion="'+ci+'">×</button></div><div class="range-grid">';
  state.decision.options.forEach((o,oi)=>{
   const v=c.values[oi]||{low:50,mid:60,high:70};h+='<div class="range-cell"><strong>'+esc(o.name)+'</strong><label>Low<input data-v="'+ci+':'+oi+':low" type="number" min="0" max="100" value="'+v.low+'"></label><label>Likely<input data-v="'+ci+':'+oi+':mid" type="number" min="0" max="100" value="'+v.mid+'"></label><label>High<input data-v="'+ci+':'+oi+':high" type="number" min="0" max="100" value="'+v.high+'"></label></div>';
  });
  h+='</div></div>';
 });
 return h;
}
function renderBuild(){
 $('#decisionName').value=state.decision.name;$('#decisionContext').value=state.decision.context;$('#domainSelect').value=state.decision.domain;$('#horizonSelect').value=state.decision.horizon;$('#riskSelect').value=state.decision.risk;$('#objectiveSelect').value=state.decision.objective;$('#modelObjectiveInline').value=state.decision.objective;
 $('#optionEditor').innerHTML=state.decision.options.map((o,i)=>'<div class="row-editor"><input data-oi="'+i+'" value="'+esc(o.name)+'" placeholder="Option '+(i+1)+'"><input class="mini" data-ocost="'+i+'" type="number" value="'+(o.cost||0)+'" placeholder="cost"><input class="mini" data-otime="'+i+'" type="number" value="'+(o.time||0)+'" placeholder="hours"><input class="mini" data-orisk="'+i+'" type="number" min="0" max="100" value="'+(o.risk||30)+'" placeholder="risk"><button class="icon-btn" data-remove-option="'+i+'">×</button></div>').join('');
 $('#criteriaEditor').innerHTML=buildRowsHTML();
 const gs=[...new Set(state.decision.criteria.map(c=>c.group||'general'))];
 $('#correlationEditor').innerHTML=gs.map(g=>'<div class="corr-line"><strong>'+esc(g)+'</strong><span>'+state.decision.criteria.filter(c=>(c.group||'general')===g).length+' criteria share this group; correlation-aware weighting reduces double counting.</span></div>').join('');
}
function renderDomainOptions(){
 $('#domainSelect').innerHTML=Object.entries(DOMAINS).map(([k,v])=>'<option value="'+k+'">'+esc(v.label)+'</option>').join('');
 $('#objectiveSelect').innerHTML=Object.entries(OBJECTIVES).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('');
 $('#modelObjectiveInline').innerHTML=Object.entries(OBJECTIVES).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('');
}
function applyDomain(k){
 const pack=DOMAINS[k]||DOMAINS.general;state.decision.domain=k;
 const opts=state.decision.options.length?state.decision.options:[{id:uid(),name:'Option A',cost:0,time:0,risk:30},{id:uid(),name:'Option B',cost:0,time:0,risk:30},{id:uid(),name:'Option C',cost:0,time:0,risk:30}];
 state.decision.criteria=pack.criteria.map((name,i)=>({id:uid(),name,direction:/cost|risk|time|price|expense|fees/i.test(name)?'lower':'higher',group:conceptKey(name),values:opts.map((_,oi)=>({low:45+i*2+oi*2,mid:55+i*2+oi*2,high:65+i*2+oi*2}))}));
 state.decision.options=opts;state.learning.criteria={};state.learning.options={};state.learning.questionHistory=[];state.simulation=null;save();renderAll();
}
function saveDecision(){
 state.decision.name=$('#decisionName').value.trim();state.decision.context=$('#decisionContext').value.trim();state.decision.horizon=$('#horizonSelect').value;state.decision.risk=$('#riskSelect').value;state.decision.objective=$('#objectiveSelect').value;
 state.history.unshift({id:state.decision.id,t:now(),name:state.decision.name,snapshot:JSON.parse(JSON.stringify(state.decision)),events:JSON.parse(JSON.stringify(state.learning.events||[]))});state.history=state.history.slice(0,60);state.lastEvaluatedAt=now();save();
}

function renderInterview(){
 const q=currentQuestion(),cons=consistency();$('#learnBar').style.width=clamp((state.learning.comparisons.length/12),0,1)*100+'%';$('#learnCount').textContent=state.learning.comparisons.length+' observations';
 $('#consistencyList').innerHTML=(cons.conflicts.length?cons.conflicts.map(x=>'<div class="warning"><strong>Possible conflict:</strong> '+esc(x.a)+' vs '+esc(x.b)+'</div>').join(''):'<div class="goodline">No direct pair contradictions detected.</div>')+'<div class="micro-panel"><strong>'+fmtPct(cons.score)+'</strong><span>consistency proxy across recorded criterion comparisons</span></div>';
 const vs=state.decision.criteria.map((c,i)=>({name:c.name,score:criterionLatent(i).variance*(.7+criterionLeverage(i))})).sort((a,b)=>b.score-a.score).slice(0,5);
 $('#voiInterview').innerHTML=vs.map((x,i)=>'<div class="info-row"><strong>'+(i+1)+'. '+esc(x.name)+'</strong><span>information value '+x.score.toFixed(2)+'</span></div>').join('');
 if(!q){$('#questionTitle').textContent='Learning pass complete';$('#questionText').textContent='The remaining unanswered questions have low expected information value. Analyze or create another scenario.';$('#questionChoices').innerHTML='';$('#learningTrace').innerHTML='<div class="trace-item">Active learning stopped because the remaining questions have low ambiguity or low ranking impact.</div>';return}
 if(q.type==='criterion'){const a=state.decision.criteria[q.a].name,b=state.decision.criteria[q.b].name;$('#questionTitle').textContent='Which matters more right now?';$('#questionText').textContent=a+' vs '+b+'. Choose the one you would protect first if you could only keep one.';$('#questionChoices').innerHTML='<button class="choice" data-choice="a">'+esc(a)+'</button><button class="choice" data-choice="b">'+esc(b)+'</button><button class="choice" data-choice="tie">About equal</button>';$('#learningTrace').innerHTML='<div class="trace-item"><strong>Selection:</strong> ambiguity + latent uncertainty + estimated ranking impact.</div><div class="trace-item"><strong>Update:</strong> Bradley–Terry-style logistic preference update with uncertainty shrinkage.</div><div class="trace-item"><strong>Why now:</strong> '+esc(q.reason)+'</div>'}
 else{const a=state.decision.options[q.a].name,b=state.decision.options[q.b].name;$('#questionTitle').textContent='Which alternative fits you better?';$('#questionText').textContent=a+' vs '+b+'. Ignore small differences; choose based on the whole tradeoff.';$('#questionChoices').innerHTML='<button class="choice" data-choice="a">'+esc(a)+'</button><button class="choice" data-choice="b">'+esc(b)+'</button><button class="choice" data-choice="tie">Too close to call</button>';$('#learningTrace').innerHTML='<div class="trace-item"><strong>Selection:</strong> closeness of current scores + latent uncertainty.</div><div class="trace-item"><strong>Update:</strong> direct option preference signal blended at low weight to avoid overriding evidence scores.</div><div class="trace-item"><strong>Why now:</strong> '+esc(q.reason)+'</div>'}
}

function criterionLeverage(i){const w=baseWeights(),hi=w.slice(),lo=w.slice();hi[i]*=1.5;lo[i]*=.6;normalize(hi);normalize(lo);return rank(state.decision.objective,{weights:hi})[0]?.name!==rank(state.decision.objective,{weights:lo})[0]?.name?1:.35}
function explain(){
 const rows=rank(),top=rows[0],w=baseWeights(),items=state.decision.criteria.map((c,ci)=>{let x=triMean(c.values[top.index]);if(c.direction==='lower')x=100-x;return {name:c.name,contribution:w[ci]*x,score:x}}).sort((a,b)=>b.contribution-a.contribution);
 return {top,items}
}
function renderModel(){
 const rows=rank(),top=rows[0],c=confidence(rows),reg=expectedRegret(rows),pareto=paretoSet();
 $('#modelLeader').textContent=top?.name||'—';$('#modelLeaderScore').textContent=top?'score '+fmtNum(top.score):'—';$('#modelConfidence').textContent=fmtPct(c);$('#modelRegret').textContent=Math.round(reg*100)+'%';$('#modelPareto').textContent=pareto.length;
 $('#resultBars').innerHTML=rows.map(r=>'<div class="bar-row"><span>'+esc(r.name)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+clamp(r.score/100,0,1)*100+'%"></div></div><strong>'+fmtNum(r.score)+'</strong></div>').join('');
 $('#sensitivityList').innerHTML=sensitivity().map(x=>'<div class="info-row"><div><strong>'+esc(x.name)+'</strong><small>'+esc(x.detail)+'</small></div><span class="pill '+(x.flip?'warn':'good')+'">'+(x.flip?'sensitive':'stable')+'</span></div>').join('');
 $('#paretoExplorer').innerHTML=pareto.map(i=>{const vals=state.decision.criteria.map((c,ci)=>{let x=triMean(c.values[i]);if(c.direction==='lower')x=100-x;return Math.round(x)});return '<div class="pareto-card"><strong>'+esc(state.decision.options[i].name)+'</strong><span>'+vals.join(' • ')+'</span></div>'}).join('')||'<div class="empty">No Pareto set.</div>';
 const groups={};state.decision.criteria.forEach((c,i)=>{const g=c.group||'general';if(!groups[g])groups[g]=[];groups[g].push(i)});
 $('#corrView').innerHTML=Object.entries(groups).map(([g,ix])=>'<div class="corr-box"><strong>'+esc(g)+'</strong><span>'+ix.map(i=>esc(state.decision.criteria[i].name)).join(', ')+'</span><small>effective weight factor '+(1/Math.sqrt(ix.length)).toFixed(2)+'</small></div>').join('');
 const ex=explain();$('#explainBreakdown').innerHTML=ex.items.map((x,i)=>'<div class="contrib"><span>'+esc(x.name)+'</span><div><div class="mini-bar"><i style="width:'+clamp(x.contribution/Math.max(ex.items[0]?.contribution||1,1),0,1)*100+'%"></i></div></div><strong>'+fmtNum(x.contribution)+'</strong></div>').join('');
}

function renderScenarioControls(){
 const weights=state.decision.criteria.map((c,i)=>'<label>'+esc(c.name)+'<input data-scenario-w="'+i+'" type="range" min="50" max="180" value="100"><span class="range-value" id="scenarioWVal'+i+'">100%</span></label>');
 $('#scenarioControls').innerHTML=weights;
}
function scenarioResult(s){return rank(state.decision.objective,{weights:(s.weights||baseWeights()).slice(),criterionMultipliers:s.criterionMultipliers})[0]}
function renderScenarios(){
 const arr=state.scenarios||[];$('#scenarioResults').innerHTML=arr.length?arr.map((s,i)=>{const r=scenarioResult(s);return '<div class="scenario-row"><div><strong>'+esc(s.name)+'</strong><small>'+esc(s.note||'')+'</small></div><div><span>leader</span><strong>'+esc(r?.name||'—')+'</strong></div><button class="icon-btn" data-remove-scenario="'+i+'">×</button></div>'}).join(''):'<div class="empty">No scenarios yet.</div>';
}
function renderCausal(){
 const nodes=state.causal.nodes,edges=state.causal.edges;
 $('#causalNodes').innerHTML=nodes.map((n,i)=>'<div class="row-editor"><input data-cnode-name="'+i+'" value="'+esc(n.name)+'"><input class="mini" data-cnode-base="'+i+'" type="number" min="0" max="100" value="'+n.base+'"><button class="icon-btn" data-remove-cnode="'+i+'">×</button></div>').join('');
 $('#causalIntervene').innerHTML=nodes.map((n,i)=>'<option value="'+i+'">'+esc(n.name)+'</option>').join('');
 $('#causalTarget').innerHTML=nodes.map((n,i)=>'<option value="'+i+'">'+esc(n.name)+'</option>').join('');
 $('#causalGraph').innerHTML=edges.map((e,i)=>'<div class="info-row"><div><strong>'+esc(nodes[e.from]?.name||'?')+' → '+esc(nodes[e.to]?.name||'?')+'</strong><small>effect '+Number(e.effect).toFixed(2)+'</small></div><button class="icon-btn" data-remove-cedge="'+i+'">×</button></div>').join('')||'<div class="empty">Add at least one causal relationship.</div>';
}
function causalPropagate(interventionIndex=null,interventionValue=null){
 const n=state.causal.nodes.length,values=nodesBase();
 function nodesBase(){return state.causal.nodes.map(x=>Number(x.base)||50)}
 const out=values.slice(),forced={};if(interventionIndex!=null){out[interventionIndex]=Number(interventionValue);forced[interventionIndex]=true}
 for(let pass=0;pass<8;pass++){
  state.causal.edges.forEach(e=>{if(forced[e.to])return;const delta=(out[e.from]-50)*Number(e.effect||0);out[e.to]=clamp(out[e.to]+delta,0,100)});
 }
 return out;
}
function runCausal(){
 const ii=Number($('#causalIntervene').value)||0,ti=Number($('#causalTarget').value)||0,val=Number($('#causalValue').value)||50;
 const base=causalPropagate(),doV=causalPropagate(ii,val),delta=doV[ti]-base[ti];
 const direct=state.causal.edges.filter(e=>e.from===ii&&e.to===ti).reduce((s,e)=>s+(Number(e.effect)||0),0);
 $('#causalResult').innerHTML='<div class="trace-item"><strong>Baseline target:</strong> '+base[ti].toFixed(1)+'</div><div class="trace-item"><strong>Intervened target:</strong> '+doV[ti].toFixed(1)+'</div><div class="trace-item"><strong>Total modeled effect:</strong> '+(delta>=0?'+':'')+delta.toFixed(1)+' points</div><div class="trace-item"><strong>Direct edge effect:</strong> '+direct.toFixed(2)+' • remaining effect comes through modeled paths</div><div class="warning">Interpretation depends entirely on the causal relationships you entered; the lab does not infer causality automatically.</div>';
 state.learning.events.push({type:'causal-intervention',t:now(),from:ii,to:ti,value:val,delta});save();
}
function renderTree(){
 $('#treeBranches').innerHTML=state.tree.branches.map((b,i)=>'<div class="tree-branch"><input data-tree-name="'+i+'" value="'+esc(b.name)+'"><input data-tree-prob="'+i+'" type="number" step=".01" min="0" max="1" value="'+b.prob+'"><input data-tree-value="'+i+'" type="number" value="'+b.value+'"><button class="icon-btn" data-remove-branch="'+i+'">×</button></div>').join('');
 const total=mean(state.tree.branches.map(b=>b.prob));const ev=state.tree.branches.reduce((s,b)=>s+b.prob*b.value,0);$('#treeValue').textContent='Expected value '+fmtNum(ev);
 $('#treeAnalysis').innerHTML='<div class="trace-item">Probability sum: '+(state.tree.branches.reduce((s,b)=>s+b.prob,0)*100).toFixed(1)+'%.</div><div class="trace-item">Best branch: '+esc(state.tree.branches.slice().sort((a,b)=>b.value-a.value)[0]?.name||'—')+'.</div><div class="trace-item">Downside branch: '+esc(state.tree.branches.slice().sort((a,b)=>a.value-b.value)[0]?.name||'—')+'.</div>';
}
function renderOptimize(){
 const items=state.decision.options.map((o,i)=>({i,name:o.name,cost:Number(o.cost)||0,time:Number(o.time)||0,risk:Number(o.risk)||30,value:rank()[i]?.score||0}));
 $('#optItems').innerHTML=items.map(x=>'<div class="opt-item"><strong>'+esc(x.name)+'</strong><span>value '+fmtNum(x.value)+' • cost '+x.cost+' • '+x.time+'h • risk '+x.risk+'</span></div>').join('');
}
function optimize(){
 const budget=Number($('#optBudget').value)||Infinity,time=Number($('#optTime').value)||Infinity,risk=Number($('#optRisk').value)||Infinity,items=state.decision.options.map((o,i)=>({i,name:o.name,cost:Number(o.cost)||0,time:Number(o.time)||0,risk:Number(o.risk)||30,value:rank()[i]?.score||0}));
 let best={value:-Infinity,items:[],cost:0,time:0,risk:0};const n=items.length;
 if(n<=18){
  for(let mask=1;mask<(1<<n);mask++){let cost=0,t=0,r=0,v=0,sel=[];for(let i=0;i<n;i++)if(mask&(1<<i)){cost+=items[i].cost;t+=items[i].time;r+=items[i].risk;v+=items[i].value;sel.push(items[i])}if(cost<=budget&&t<=time&&r<=risk&&v>best.value)best={value:v,items:sel,cost,time:t,risk:r}}
 }else{
  const sorted=items.slice().sort((a,b)=>(b.value/Math.max(1,b.cost+b.time))-(a.value/Math.max(1,a.cost+a.time)));let cost=0,t=0,r=0,v=0,sel=[];sorted.forEach(x=>{if(cost+x.cost<=budget&&t+x.time<=time&&r+x.risk<=risk){cost+=x.cost;t+=x.time;r+=x.risk;v+=x.value;sel.push(x)}});best={value:v,items:sel,cost,time:t,risk:r};
 }
 $('#optValue').textContent=best.items.length?'Portfolio value '+fmtNum(best.value):'No feasible combination';$('#optResult').innerHTML=best.items.length?['Selected: '+best.items.map(x=>x.name).join(', '),'Cost: '+best.cost,'Time: '+best.time+' h','Risk budget use: '+best.risk].map(x=>'<div class="trace-item">'+esc(x)+'</div>').join(''):'<div class="warning">Relax a resource constraint or edit option costs/times.</div>';
 state.learning.events.push({type:'optimize',t:now(),count:best.items.length});save();
}

function renderGroup(){
 const cs=state.decision.criteria;
 $('#memberEditor').innerHTML=state.group.members.map((m,mi)=>{
  return '<div class="member-card"><div class="row-editor"><input data-member-name="'+mi+'" value="'+esc(m.name)+'"><input data-member-influence="'+mi+'" type="number" min="0.1" step=".1" value="'+(m.influence||1)+'"></div>'+cs.map((c,ci)=>'<label>'+esc(c.name)+'<input data-member-weight="'+mi+':'+ci+'" type="range" min="0" max="100" value="'+Math.round((m.weights?.[c.id]??(100/cs.length)))+'"><span class="range-value" id="mw'+mi+'_'+ci+'">'+Math.round((m.weights?.[c.id]??(100/cs.length)))+'%</span></label>').join('')+'</div>'
 }).join('');
 const agg=cs.map(c=>({name:c.name,weight:mean(state.group.members.map(m=>Number(m.weights?.[c.id]??(100/cs.length))))}));normalize(agg.map(x=>x.weight));const vals=cs.map((c,i)=>mean(state.group.members.map(m=>Number(m.weights?.[c.id]??(100/cs.length)))));normalize(vals);
 const rows=cs.map((c,i)=>({name:c.name,weight:vals[i]})).sort((a,b)=>b.weight-a.weight);
 $('#groupResult').innerHTML=rows.map(x=>'<div class="bar-row"><span>'+esc(x.name)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+x.weight*100+'%"></div></div><strong>'+fmtPct(x.weight)+'</strong></div>').join('');
 $('#groupDisagreement').innerHTML=cs.map((c,ci)=>{const vals=state.group.members.map(m=>Number(m.weights?.[c.id]??50));const d=sd(vals);return '<div class="info-row"><span>'+esc(c.name)+'</span><small>disagreement '+d.toFixed(1)+' points</small></div>'}).join('');
}
function memberWeights(m){const arr=state.decision.criteria.map(c=>Number(m.weights?.[c.id]??(100/state.decision.criteria.length)));normalize(arr);return arr}
function negotiation(){
 const min=Number($('#negMin').value)||60,style=$('#negStyle').value,rows=[];
 state.decision.options.forEach((o,oi)=>{
  const sats=state.group.members.map(m=>state.decision.criteria.reduce((s,c,ci)=>s+memberWeights(m)[ci]*((c.direction==='lower'?100-triMean(c.values[oi]):triMean(c.values[oi]))/100),0)*100);
  const avg=mean(sats),mn=Math.min(...sats),mx=Math.max(...sats);
  if(mn>=min||style==='pareto')rows.push({oi,name:o.name,sats,avg,mn,mx,score:style==='fairness'?mn:style==='pareto'?avg*.7+mn*.3:avg});
 });
 rows.sort((a,b)=>b.score-a.score);state.negotiation=rows;save();
 $('#negotiationResult').innerHTML=rows.slice(0,Math.max(3,Number($('#negCount').value)||8)).map((r,i)=>'<div class="proposal"><div><strong>'+i+'. '+esc(r.name)+'</strong><small>average '+r.avg.toFixed(1)+' • minimum '+r.mn.toFixed(1)+' • spread '+(r.mx-r.mn).toFixed(1)+'</small></div><div class="avatar-row">'+r.sats.map((x,j)=>'<span title="'+esc(state.group.members[j].name)+'">'+Math.round(x)+'</span>').join('')+'</div></div>').join('')||'<div class="empty">No proposal satisfies the minimum satisfaction threshold.</div>';
}

function renderTimeline(){
 $('#timelineEditor').innerHTML=state.timeline.map((t,i)=>'<div class="timeline-row"><input data-tl-label="'+i+'" value="'+esc(t.label)+'"><input data-tl-month="'+i+'" type="number" min="0" value="'+t.month+'"><select data-tl-option="'+i+'">'+state.decision.options.map((o,j)=>'<option value="'+j+'" '+(j===t.option?'selected':'')+'>'+esc(o.name)+'</option>').join('')+'</select><input data-tl-mult="'+i+'" type="number" step=".05" min="0" value="'+t.multiplier+'"><button class="icon-btn" data-remove-tl="'+i+'">×</button></div>').join('');
 const total=state.timeline.reduce((s,t)=>s+Math.pow(.985,t.month)*optionScore(t.option||0)*t.multiplier,0);$('#timelineTotal').textContent='Projected lifetime utility '+fmtNum(total);
 const fresh=state.timeline.reduce((s,t)=>s+(t.infoGain||0),0);$('#timelineResult').innerHTML=state.timeline.map(t=>'<div class="trace-item">'+esc(t.label)+' • month '+t.month+' • '+esc(state.decision.options[t.option||0]?.name||'—')+' • discount '+(Math.pow(.985,t.month)*100).toFixed(1)+'%</div>').join('');
 const ageDays=(now()-state.lastEvaluatedAt)/86400000;$('#decayPanel').innerHTML='<strong>'+ageDays.toFixed(0)+' days since evaluation</strong><span>Long-horizon decisions become stale more slowly, but price, location and market assumptions may decay faster.</span>';
}
function renderOutcomes(){
 $('#outcomeOption').innerHTML=state.decision.options.map((o,i)=>'<option value="'+i+'">'+esc(o.name)+'</option>').join('');
 const q=$('#qualityValue'),s=$('#satisfactionValue');if(q)q.textContent=$('#outcomeQuality').value;if(s)s.textContent=$('#outcomeSatisfaction').value;
 const outs=state.learning.outcomes||[];
 $('#outcomeJournal').innerHTML=outs.length?outs.map(o=>'<div class="journal-item"><div><strong>'+esc(o.decisionName||state.decision.name)+'</strong><span>'+esc(state.decision.options[o.optionIndex]?.name||'Option')+'</span><span>'+new Date(o.t).toLocaleDateString()+'</span></div><div><strong>'+Math.round(o.actual)+'%</strong><span>'+esc(o.errorType)+'</span></div></div>').join(''):'<div class="empty">Record a real-world outcome to start calibration.</div>';
 renderCalibration();
}
function renderCalibration(){
 const outs=state.learning.outcomes||[],bins=[0,0,0,0,0],actual=[[],[],[],[],[]];
 outs.forEach(o=>{const b=Math.min(4,Math.floor(clamp(o.expected,0,99)/20));bins[b]++;actual[b].push(o.actual)});
 $('#calibrationChart').innerHTML=bins.map((n,i)=>'<div class="cal-bin"><span>'+(i*20)+'–'+(i*20+19)+'%</span><div class="cal-track"><i style="width:'+(n?Math.min(100,n/Math.max(1,outs.length)*100*3):0)+'%"></i></div><small>'+n+' outcomes'+(n?' • actual '+Math.round(mean(actual[i]))+'%':'')+'</small></div>').join('');
 const mae=outs.length?mean(outs.map(o=>Math.abs(o.expected-o.actual))):null;$('#calibrationSummary').innerHTML=outs.length?'<div class="metric-inline"><strong>'+mae.toFixed(1)+' pts</strong><span>mean absolute prediction error</span></div><div class="metric-inline"><strong>'+mean(outs.map(o=>o.satisfaction)).toFixed(1)+'</strong><span>average satisfaction after decisions</span></div>':'<div class="empty">No calibrated outcomes yet.</div>';
}
function recordOutcome(){
 const oi=Number($('#outcomeOption').value),actual=(Number($('#outcomeQuality').value)+Number($('#outcomeSatisfaction').value))/2,expected=Number($('#outcomeExpected').value)||0,errorType=$('#outcomeError').value,note=$('#outcomeNote').value.trim();
 const pred=optionScore(oi);const ol=optionLatent(oi);ol.score+=(actual/100-sigmoid(ol.score))*.6;ol.variance=clamp(ol.variance*.92,.04,1);ol.evidence++;
 state.learning.outcomes.unshift({t:now(),decisionName:state.decision.name,optionIndex:oi,actual,expected,satisfaction:Number($('#outcomeSatisfaction').value),errorType,note});
 remember(state.decision.name,actual/100,.2);state.learning.events.push({type:'outcome',t:now(),actual,expected,errorType});
 state.lastEvaluatedAt=now();save();renderAll();
}
function renderReplay(){
 $('#replaySelect').innerHTML=state.history.map((h,i)=>'<option value="'+i+'">'+esc(h.name||'Unnamed')+' — '+new Date(h.t).toLocaleDateString()+'</option>').join('');
 const idx=Number($('#replaySelect').value)||0,h=state.history[idx];
 $('#replayTimeline').innerHTML=h?(h.events||[]).map(e=>'<div class="replay-step"><span>'+new Date(e.t).toLocaleTimeString()+'</span><strong>'+esc(e.type)+'</strong><small>'+esc(JSON.stringify(e).slice(0,160))+'</small></div>').join(''):'<div class="empty">Save a decision snapshot to create a replay.</div>';
 $('#counterfactualOptions').innerHTML=state.decision.options.map((o,i)=>'<button class="choice" data-counter="'+i+'">'+esc(o.name)+'</button>').join('');
}
function counterfactual(oi){
 const rows=rank();const actual=rows[0];const alt=rows.find(x=>x.index===oi);const gap=alt?alt.score-actual.score:0;$('#counterfactualResult').innerHTML='<div class="trace-item">Modeled alternative: <strong>'+esc(alt?.name||'—')+'</strong>.</div><div class="trace-item">Difference from current leader: '+fmtNum(gap)+' score points.</div><div class="trace-item">This is a model-based counterfactual under current assumptions; it is not observed historical fact.</div>';
}
function renderMemory(){
 const pref=rankCriteria();$('#memoryPreferences').innerHTML=pref.map(x=>'<div class="memory-row"><div><strong>'+esc(x.name)+'</strong><small>'+criterionLatent(x.index).evidence+' comparison signals</small></div><strong>'+fmtPct(x.weight)+'</strong></div>').join('');
 const mem=Object.values(state.learning.concepts||{}).sort((a,b)=>b.count-a.count);$('#semanticMemory').innerHTML=mem.length?mem.slice(0,16).map(m=>'<div class="memory-chip"><strong>'+esc(m.label)+'</strong><span>'+m.count+' updates • '+Math.round(m.mean*100)+'%</span></div>').join(''):'<div class="empty">No semantic concepts learned yet.</div>';
 const age=(now()-state.lastEvaluatedAt)/86400000;$('#decayDetail').innerHTML=decayFlags().map(x=>'<div class="info-row"><strong>'+esc(x.label)+'</strong><span class="'+(x.stale?'pill warn':'pill good')+'">'+(x.stale?'refresh':'fresh')+'</span></div>').join('');
 $('#benchmarkDetail').innerHTML=benchmarkHTML();
}
function decayFlags(){
 const days=(now()-state.lastEvaluatedAt)/86400000||0;const horizon=state.decision.horizon,threshold=horizon==='short'?30:horizon==='medium'?90:horizon==='long'?180:365;
 return [
  {label:'Core decision assumptions',stale:days>threshold},
  {label:'Price / cost assumptions',stale:days>Math.max(14,threshold*.45)},
  {label:'Preference memory',stale:false},
  {label:'Outcome calibration',stale:(state.learning.outcomes||[]).length<3}
 ];
}
function benchmarkHTML(){
 const outs=state.learning.outcomes||[];if(!outs.length)return '<div class="empty">You need outcomes before the historical calibration benchmark becomes meaningful.</div>';
 const avgErr=mean(outs.map(o=>Math.abs(o.expected-o.actual)));const avgSat=mean(outs.map(o=>o.satisfaction));const ext=state.history.length;return '<div class="benchmark-grid"><div><strong>'+ext+'</strong><span>saved decisions</span></div><div><strong>'+avgErr.toFixed(1)+'</strong><span>avg prediction error</span></div><div><strong>'+avgSat.toFixed(1)+'</strong><span>avg satisfaction</span></div></div>';
}
function renderDashboard(){
 const rows=rank(),top=rows[0];if(state.decision.options.length&&(!state.simulation||now()-state.simulation.at>300000))simulate(1200);
 const robust=state.simulation?.counts?.[top?.index||0]/(state.simulation?.runs||1)||0;const cons=consistency().score;const age=state.lastEvaluatedAt?(now()-state.lastEvaluatedAt)/86400000:0;
 $('#dashLeader').textContent=top?.name||'—';$('#dashLeaderScore').textContent=top?'score '+fmtNum(top.score):'Build a decision';$('#dashRobustness').textContent=top?fmtPct(robust):'—';$('#dashConsistency').textContent=fmtPct(cons);$('#dashAge').textContent=age?age.toFixed(0)+'d':'New';$('#statObs').textContent=state.learning.comparisons.length;$('#statDecisions').textContent=state.history.length;$('#statMemory').textContent=Object.keys(state.learning.concepts||{}).length;$('#statStaleness').textContent=age<7?'Fresh':age<30?'Watch':'Refresh';
 const q=currentQuestion();const decay=decayFlags().find(x=>x.stale);$('#nextActionTitle').textContent=decay?'Refresh stale assumptions':q?'Answer one high-value question':'Run robustness simulation';$('#nextActionType').textContent=decay?'DECAY':q?'VOI':'SIMULATION';$('#nextActionText').textContent=decay?'Some assumptions have aged beyond the modelled freshness window.':q?'The system found a question that could meaningfully reduce decision uncertainty.':'The current model is ready for a robustness check.';
 const meta=[];if(q)meta.push('Next question type: '+q.type);meta.push('Pareto-efficient alternatives: '+paretoSet().length);meta.push('Objective: '+OBJECTIVES[state.decision.objective]);$('#nextActionMeta').innerHTML=meta.map(x=>'<div class="trace-item">'+esc(x)+'</div>').join('');
 const flags=decayFlags();$('#healthList').innerHTML=flags.map(x=>'<div class="info-row"><span>'+esc(x.label)+'</span><span class="'+(x.stale?'pill warn':'pill good')+'">'+(x.stale?'refresh':'ok')+'</span></div>').join('');
 const ex=explain();$('#dashExplanation').innerHTML=(ex.items||[]).slice(0,5).map(x=>'<div class="explain-card"><strong>'+esc(x.name)+'</strong><span>'+fmtNum(x.score)+' normalized score</span><small>'+fmtNum(x.contribution)+' weighted contribution</small></div>').join('');
 const h=state.history[0];$('#miniReplay').innerHTML=h?(h.events||[]).slice(-5).map(e=>'<div class="timeline-mini-item"><span>'+new Date(e.t).toLocaleTimeString()+'</span><strong>'+esc(e.type)+'</strong></div>').join(''):'<div class="empty">No replay yet.</div>';$('#benchmarkDash').innerHTML=benchmarkHTML();
}
function renderTemplates(){
 $('#templateGrid').innerHTML=Object.entries(DOMAINS).map(([k,v])=>'<button class="template-card" data-template="'+k+'"><strong>'+esc(v.label)+'</strong><span>'+v.criteria.slice(0,6).map(esc).join(' • ')+'</span></button>').join('');
}
function setTab(tab){
 $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$$('.panel').forEach(p=>p.classList.toggle('active',p.id==='panel-'+tab));renderPanel(tab);
}
function renderPanel(tab){
 if(tab==='dashboard')renderDashboard();
 if(tab==='build')renderBuild();
 if(tab==='interview')renderInterview();
 if(tab==='model')renderModel();
 if(tab==='scenarios'){renderScenarioControls();renderScenarios();}
 if(tab==='tree')renderTree();
 if(tab==='optimize')renderOptimize();
 if(tab==='group')renderGroup();
 if(tab==='negotiate'){renderGroup();if(state.negotiation.length)$('#negotiationResult').innerHTML=state.negotiation.map(r=>'<div class="proposal"><strong>'+esc(r.name)+'</strong><small>avg '+r.avg.toFixed(1)+' • min '+r.mn.toFixed(1)+'</small></div>').join('')}
 if(tab==='timeline')renderTimeline();
 if(tab==='outcomes')renderOutcomes();
 if(tab==='replay')renderReplay();
 if(tab==='memory')renderMemory();
 if(tab==='templates')renderTemplates();
}
function renderAll(){renderPanel('dashboard');renderBuild();renderInterview();renderModel();renderScenarioControls();renderScenarios();renderTree();renderOptimize();renderGroup();renderTimeline();renderOutcomes();renderReplay();renderMemory();renderTemplates();}

function demo(){
 state=emptyState();
 state.decision={id:uid(),name:'Choose a new laptop',context:'I need a laptop for coding, study and travel. I care about reliability but do not want to overspend.',domain:'technology',horizon:'long',risk:'balanced',objective:'robust',
 options:[{id:uid(),name:'ThinkPad X1',cost:1200,time:10,risk:18},{id:uid(),name:'MacBook Air',cost:1300,time:8,risk:15},{id:uid(),name:'Zenbook 14',cost:950,time:12,risk:24}],
 criteria:[
  {id:uid(),name:'Price',direction:'lower',group:'cost',values:[{low:72,mid:78,high:84},{low:62,mid:70,high:76},{low:82,mid:88,high:94}]},
  {id:uid(),name:'Performance',direction:'higher',group:'performance',values:[{low:84,mid:90,high:95},{low:82,mid:88,high:92},{low:74,mid:82,high:88}]},
  {id:uid(),name:'Battery life',direction:'higher',group:'battery',values:[{low:76,mid:84,high:91},{low:88,mid:95,high:98},{low:72,mid:80,high:87}]},
  {id:uid(),name:'Reliability',direction:'higher',group:'reliability',values:[{low:87,mid:92,high:97},{low:84,mid:90,high:95},{low:72,mid:80,high:88}]},
  {id:uid(),name:'Portability',direction:'higher',group:'portability',values:[{low:72,mid:80,high:87},{low:86,mid:93,high:97},{low:84,mid:91,high:95}]}
 ]};
 state.lastEvaluatedAt=now();save();renderAll();setTab('dashboard');
}
function exportProfile(){
 const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='decision-lab-profile.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
function clearLearning(){state.learning=emptyState().learning;state.simulation=null;save();renderAll()}
function importProfile(file){const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);state=x;save();renderAll()}catch(e){alert('Invalid Decision Lab profile.')}};r.readAsText(file)}

load();renderDomainOptions();

document.addEventListener('click',e=>{
 const tab=e.target.closest('[data-tab]');if(tab){setTab(tab.dataset.tab);return}
 const jump=e.target.closest('[data-jump]');if(jump){setTab(jump.dataset.jump);return}
 if(e.target.id==='loadDemo')demo();
 if(e.target.id==='resetAll'){if(confirm('Reset the entire local Decision Lab state?')){localStorage.removeItem(KEY);state=emptyState();renderAll();}}
 if(e.target.id==='openModelCard'){$('#modelModal').classList.add('open')}
 if(e.target.id==='closeModelCard'){$('#modelModal').classList.remove('open')}
 if(e.target.id==='addOption'){state.decision.options.push({id:uid(),name:'Option '+String.fromCharCode(65+state.decision.options.length),cost:0,time:0,risk:30});state.decision.criteria.forEach(c=>c.values.push({low:50,mid:60,high:70}));save();renderBuild()}
 if(e.target.id==='addCriterion'){state.decision.criteria.push({id:uid(),name:'Criterion '+(state.decision.criteria.length+1),direction:'higher',group:'general',values:state.decision.options.map(()=>({low:50,mid:60,high:70}))});save();renderBuild()}
 if(e.target.id==='saveDecision'){syncBuild();saveDecision();renderAll();alert('Decision snapshot saved.')}
 if(e.target.id==='startInterview'){syncBuild();saveDecision();setTab('interview')}
 if(e.target.dataset.choice){const q=currentQuestion();if(q){addComparison(q,e.target.dataset.choice)}}
 if(e.target.id==='addCausalNode'){state.causal.nodes.push({id:uid(),name:'New node',base:50});save();renderCausal()}
 if(e.target.id==='addCausalEdge'){if(state.causal.nodes.length>=2){state.causal.edges.push({from:0,to:Math.min(1,state.causal.nodes.length-1),effect:.2});save();renderCausal()}}
 if(e.target.id==='runCausal'){runCausal()}
 if(e.target.dataset.removeCnode){const i=Number(e.target.dataset.removeCnode);const removed=state.causal.nodes[i].id;state.causal.nodes.splice(i,1);state.causal.edges=state.causal.edges.filter(e=>e.from!==i&&e.to!==i).map(e=>({from:e.from>i?e.from-1:e.from,to:e.to>i?e.to-1:e.to,effect:e.effect}));save();renderCausal()}
 if(e.target.dataset.removeCedge){state.causal.edges.splice(Number(e.target.dataset.removeCedge),1);save();renderCausal()}
 if(e.target.id==='addScenario'){const weights=baseWeights();state.scenarios.push({id:uid(),name:$('#scenarioName').value||'Scenario '+(state.scenarios.length+1),note:$('#scenarioNote').value,weights:weights.map((x,i)=>x*(Number($('[data-scenario-w="'+i+'"]').value||100)/100)),criterionMultipliers:state.decision.criteria.map(()=>1)});save();renderScenarios()}
 if(e.target.id==='addBranch'){state.tree.branches.push({name:'New branch',prob:.1,value:0});renderTree()}
 if(e.target.id==='calcTree'){syncTree();renderTree();save()}
 if(e.target.id==='runOptimize'){optimize()}
 if(e.target.id==='addMember'){state.group.members.push({id:uid(),name:'Member '+(state.group.members.length+1),influence:1,weights:{}});save();renderGroup()}
 if(e.target.id==='runNegotiation'){negotiation()}
 if(e.target.id==='addTimeline'){state.timeline.push({label:'New stage',month:state.timeline.length*6,option:0,multiplier:1,infoGain:0});renderTimeline()}
 if(e.target.id==='runTimeline'){syncTimeline();state.lastEvaluatedAt=now();save();renderTimeline()}
 if(e.target.id==='recordOutcome'){recordOutcome()}
 if(e.target.id==='exportProfile'){exportProfile()}
 if(e.target.id==='clearLearning'){if(confirm('Clear all learned preferences, semantic memory and calibration?'))clearLearning()}
 if(e.target.dataset.template){applyDomain(e.target.dataset.template);setTab('build')}
 if(e.target.dataset.counter){counterfactual(Number(e.target.dataset.counter))}
 if(e.target.dataset.removeOption){const i=Number(e.target.dataset.removeOption);state.decision.options.splice(i,1);state.decision.criteria.forEach(c=>c.values.splice(i,1));save();renderBuild()}
 if(e.target.dataset.removeCriterion){state.decision.criteria.splice(Number(e.target.dataset.removeCriterion),1);save();renderBuild()}
 if(e.target.dataset.removeScenario){state.scenarios.splice(Number(e.target.dataset.removeScenario),1);save();renderScenarios()}
 if(e.target.dataset.removeBranch){state.tree.branches.splice(Number(e.target.dataset.removeBranch),1);renderTree()}
 if(e.target.dataset.removeTl){state.timeline.splice(Number(e.target.dataset.removeTl),1);renderTimeline()}
});

document.addEventListener('input',e=>{
 if(e.target.matches('[data-v],[data-oi],[data-ocost],[data-otime],[data-orisk],[data-group],[data-ci],[data-direction],[data-member-name],[data-member-influence],[data-member-weight],[data-scenario-w],[data-tl-label],[data-tl-month],[data-tl-mult]'))syncLive(e);
 if(e.target.id==='outcomeQuality')$('#qualityValue').textContent=e.target.value;
 if(e.target.id==='outcomeSatisfaction')$('#satisfactionValue').textContent=e.target.value;
 if(e.target.dataset.scenarioW)$('#scenarioWVal'+e.target.dataset.scenarioW).textContent=e.target.value+'%';
});
document.addEventListener('change',e=>{
 if(e.target.id==='domainSelect'){applyDomain(e.target.value)}
 if(e.target.id==='objectiveSelect'){state.decision.objective=e.target.value;save();renderModel();renderDashboard()}
 if(e.target.id==='modelObjectiveInline'){state.decision.objective=e.target.value;$('#objectiveSelect').value=e.target.value;save();renderModel();renderDashboard()}
 if(e.target.id==='replaySelect')renderReplay();
 if(e.target.matches('[data-remove-option],[data-remove-criterion],[data-remove-scenario],[data-remove-branch],[data-remove-tl]')){}
});
$('#importProfile').addEventListener('change',e=>{if(e.target.files[0])importProfile(e.target.files[0])});

function syncLive(e){
 const t=e.target;
 if(t.dataset.oi!=null)state.decision.options[Number(t.dataset.oi)].name=t.value;
 if(t.dataset.ocost!=null)state.decision.options[Number(t.dataset.ocost)].cost=Number(t.value)||0;
 if(t.dataset.otime!=null)state.decision.options[Number(t.dataset.otime)].time=Number(t.value)||0;
 if(t.dataset.orisk!=null)state.decision.options[Number(t.dataset.orisk)].risk=Number(t.value)||0;
 if(t.dataset.ci!=null)state.decision.criteria[Number(t.dataset.ci)].name=t.value;
 if(t.dataset.direction!=null)state.decision.criteria[Number(t.dataset.direction)].direction=t.value;
 if(t.dataset.group!=null)state.decision.criteria[Number(t.dataset.group)].group=t.value||'general';
 if(t.dataset.v){const [ci,oi,k]=t.dataset.v.split(':');state.decision.criteria[Number(ci)].values[Number(oi)][k]=Number(t.value)||0}
 if(t.dataset.cnodeName!=null)state.causal.nodes[Number(t.dataset.cnodeName)].name=t.value;
 if(t.dataset.cnodeBase!=null)state.causal.nodes[Number(t.dataset.cnodeBase)].base=Number(t.value)||0;
 if(t.dataset.memberName!=null)state.group.members[Number(t.dataset.memberName)].name=t.value;
 if(t.dataset.memberInfluence!=null)state.group.members[Number(t.dataset.memberInfluence)].influence=Number(t.value)||1;
 if(t.dataset.memberWeight){const [mi,ci]=t.dataset.memberWeight.split(':');const c=state.decision.criteria[Number(ci)];state.group.members[Number(mi)].weights[c.id]=Number(t.value);$('#mw'+mi+'_'+ci).textContent=t.value+'%';}
 if(t.dataset.tlLabel!=null)state.timeline[Number(t.dataset.tlLabel)].label=t.value;
 if(t.dataset.tlMonth!=null)state.timeline[Number(t.dataset.tlMonth)].month=Number(t.value)||0;
 if(t.dataset.tlMult!=null)state.timeline[Number(t.dataset.tlMult)].multiplier=Number(t.value)||1;
 save();
 if(['dashboard','model'].some(x=>$('#panel-'+x).classList.contains('active')))renderPanel('dashboard'),renderPanel('model');
}
function syncBuild(){
 state.decision.name=$('#decisionName').value.trim();state.decision.context=$('#decisionContext').value.trim();state.decision.horizon=$('#horizonSelect').value;state.decision.risk=$('#riskSelect').value;state.decision.objective=$('#objectiveSelect').value;state.lastEvaluatedAt=now();save();
}
function syncTree(){
 state.tree.root=$('#treeRoot').value;state.tree.branches.forEach((b,i)=>{b.name=$('[data-tree-name="'+i+'"]').value;b.prob=Number($('[data-tree-prob="'+i+'"]').value)||0;b.value=Number($('[data-tree-value="'+i+'"]').value)||0});
}
function syncTimeline(){
 state.timeline.forEach((t,i)=>{t.label=$('[data-tl-label="'+i+'"]').value;t.month=Number($('[data-tl-month="'+i+'"]').value)||0;t.option=Number($('[data-tl-option="'+i+'"]').value);t.multiplier=Number($('[data-tl-mult="'+i+'"]').value)||1});
}

function serviceWorkerNotice(){if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{})}
renderAll();serviceWorkerNotice();
})();