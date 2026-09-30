// --- Local semantic feature hashing (privacy preserving) ---
function tokens(text){return String(text).toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(Boolean)}
function hashWord(w){let h=2166136261;for(let i=0;i<w.length;i++){h^=w.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h)%FEATURE_DIM}
function semanticVector(text){
  const v=new Float64Array(FEATURE_DIM); const ts=tokens(text);
  ts.forEach(t=>{v[hashWord(t)]+=1; Object.entries(SYNONYMS).forEach(([concept,words])=>{if(words.includes(t))v[hashWord('concept:'+concept)]+=1})});
  for(let i=0;i<FEATURE_DIM;i++)v[i]=v[i]/Math.sqrt(1+ts.length);
  return v;
}
function cosine(a,b){let d=0,na=0,nb=0;for(let i=0;i<FEATURE_DIM;i++){d+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i]}return d/(Math.sqrt(na)*Math.sqrt(nb)||1)}
function canonicalConcept(text){
  const ts=tokens(text); let best={k:null,s:0};
  Object.entries(SYNONYMS).forEach(([k,words])=>{const hit=ts.filter(t=>words.includes(t)).length; if(hit>best.s)best={k,s:hit}});
  return best.k||ts.slice(0,2).join('-')||'general';
}
function rememberConcept(name,signal){
  const vec=semanticVector(name),concept=canonicalConcept(name),old=state.learning.conceptMemory[concept];
  if(!old){state.learning.conceptMemory[concept]={label:name,vector:Array.from(vec),mean:signal,count:1,variance:.5};return}
  const rate=1/Math.min(18,old.count+1);old.mean += rate*(signal-old.mean);old.count++;old.variance=clamp(old.variance*(1-rate*.4)+Math.abs(signal-old.mean)*.12,.04,1);if(cosine(vec,old.vector)>.45){for(let i=0;i<FEATURE_DIM;i++)old.vector[i]=old.vector[i]*.85+vec[i]*.15;}}
function semanticPrior(name){
  const vec=semanticVector(name);let best=null,bestSim=0;
  Object.values(state.learning.conceptMemory||{}).forEach(m=>{const s=cosine(vec,m.vector);if(s>bestSim){bestSim=s;best=m}});
  return best&&bestSim>.38?{signal:best.mean,similarity:bestSim,label:best.label}:null;
}

function ensureLatents(){
  state.decision.criteria.forEach((c,i)=>{if(!state.learning.criterionLatents[i]){const prior=semanticPrior(c.name);state.learning.criterionLatents[i]={score:((prior?.signal||0)-0.5)*.25,variance:prior?.similarity>.65?.38:.58,evidence:prior?1:0};}});
  state.decision.options.forEach((o,i)=>{if(!state.learning.optionLatents[i])state.learning.optionLatents[i]={score:0,variance:.9,evidence:0};});
}
function renderSetup(){
  $('#decisionName').value=state.decision.name||'';$('#decisionContext').value=state.decision.context||'';$('#horizonSelect').value=state.decision.horizon||'medium';$('#riskSelect').value=state.decision.risk||'balanced';
  const ol=$('#optionsList');ol.innerHTML='';state.decision.options.forEach((o,i)=>{const d=document.createElement('div');d.className='row-editor';d.innerHTML=`<input data-option-index="${i}" value="${esc(o.name)}" placeholder="Option name"><button class="icon-btn" data-remove-option="${i}">×</button>`;ol.appendChild(d)});
  const cl=$('#criteriaList');cl.innerHTML='';state.decision.criteria.forEach((c,i)=>{const d=document.createElement('div');d.className='criterion';d.innerHTML=`<input data-criterion-index="${i}" value="${esc(c.name)}" placeholder="Criterion"><select data-direction-index="${i}"><option value="higher" ${c.direction==='higher'?'selected':''}>Higher is better</option><option value="lower" ${c.direction==='lower'?'selected':''}>Lower is better</option></select><button class="icon-btn" data-remove-criterion="${i}">×</button>`;cl.appendChild(d)});renderMatrix();
}
function syncInputs(){
  state.decision.name=$('#decisionName').value.trim();state.decision.context=$('#decisionContext').value.trim();state.decision.horizon=$('#horizonSelect').value;state.decision.risk=$('#riskSelect').value;
  $$('[data-option-index]').forEach(x=>state.decision.options[+x.dataset.optionIndex].name=x.value);
  $$('[data-criterion-index]').forEach(x=>state.decision.criteria[+x.dataset.criterionIndex].name=x.value);
  $$('[data-direction-index]').forEach(x=>state.decision.criteria[+x.dataset.directionIndex].direction=x.value);
  $$('[data-score]').forEach(x=>{const k=`${+x.dataset.option}:${+x.dataset.criterion}`;state.decision.scores[k]=clamp(Number(x.value)||0,0,100)});
  save();renderMatrix();
}
function renderMatrix(){
  const {options,criteria,scores}=state.decision;const el=$('#scoreMatrix');if(!options.length||!criteria.length){el.innerHTML='<p class="muted">Add at least one option and one criterion.</p>';return}
  let h='<table class="matrix"><thead><tr><th>Option</th>'+criteria.map(c=>`<th>${esc(c.name||'Untitled')}</th>`).join('')+'</tr></thead><tbody>';
  options.forEach((o,oi)=>{h+=`<tr><td><strong>${esc(o.name)}</strong></td>`;criteria.forEach((c,ci)=>{const v=state.decision.scores[`${oi}:${ci}`]??50;h+=`<td><input class="score-input" type="number" min="0" max="100" step="1" data-score data-option="${oi}" data-criterion="${ci}" value="${v}"></td>`});h+='</tr>'});h+='</tbody></table>';el.innerHTML=h;
}
