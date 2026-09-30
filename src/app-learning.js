// --- Preference learning ---
function updateLogitPair(map,a,b,winner,strength=1){
  const A=map[a]||{score:0,variance:1,evidence:0},B=map[b]||{score:0,variance:1,evidence:0};
  const p=sigmoid(A.score-B.score);const target=winner===a?1:winner===b?0:.5;const err=(target-p)*strength;A.score+=err*.42;B.score-=err*.42;A.variance=clamp(A.variance*(1-.035*strength),.05,1.2);B.variance=clamp(B.variance*(1-.035*strength),.05,1.2);A.evidence++;B.evidence++;map[a]=A;map[b]=B;
}
function updateCriterionPairwise(a,b,winner,strength=1){updateLogitPair(state.learning.criterionLatents,a,b,winner,strength);}
function recordComparison(q,side){
  const winner=side==='a'?q.a:q.b;const strength=q.strength||1;state.learning.comparisons.push({id:uid(),type:q.type,a:q.a,b:q.b,winner,strength,reason:q.reason,t:Date.now()});
  if(q.type==='criterion'){updateCriterionPairwise(q.a,q.b,winner,strength);rememberConcept(state.decision.criteria[winner].name,0.55+0.45*strength)}
  else updateLogitPair(state.learning.optionLatents,q.a,q.b,winner,strength*.9);
  state.learning.seenQuestions=state.learning.seenQuestions.filter(k=>k!==q.key);save();renderAll();setTab('learn');
}
function criterionWeights(){ensureLatents();const logits=state.decision.criteria.map((c,i)=>state.learning.criterionLatents[i].score);let raw=logits.map(x=>Math.exp(clamp(x,-4,4)));const global=state.decision.criteria.map(c=>semanticPrior(c.name)?.signal||0);raw=raw.map((v,i)=>v*Math.exp((global[i]||0)*.08));const sum=raw.reduce((a,b)=>a+b,0)||1;return raw.map(x=>x/sum)}
function normalizedScore(oi,ci){const c=state.decision.criteria[ci];const v=Number(state.decision.scores[`${oi}:${ci}`]??50)/100;return c.direction==='lower'?1-v:v}
function optionSignal(oi){const x=state.learning.optionLatents[oi];return x?sigmoid(x.score):.5}
function calculateResults(weights=criterionWeights(),mix=.16){return state.decision.options.map((o,oi)=>{let utility=0;state.decision.criteria.forEach((c,ci)=>utility+=weights[ci]*normalizedScore(oi,ci));const ps=optionSignal(oi);return {index:oi,name:o.name,utility:(1-mix)*utility+mix*ps,rawUtility:utility,preferenceSignal:ps}}).sort((a,b)=>b.utility-a.utility)}
function entropy(p){const q=clamp(p,.0001,.9999);return -(q*Math.log2(q)+(1-q)*Math.log2(1-q))}
function pickQuestion(){
  ensureLatents();const candidates=[];const seen=new Set(state.learning.seenQuestions);
  for(let i=0;i<state.decision.criteria.length;i++)for(let j=i+1;j<state.decision.criteria.length;j++){
    const A=state.learning.criterionLatents[i],B=state.learning.criterionLatents[j];const p=sigmoid(A.score-B.score),unc=Math.sqrt(A.variance+B.variance);const current=criterionWeights();const base=calculateResults(current)[0];
    const wi=[...current],wj=[...current];wi[i]*=1.25;wj[j]*=1.25;normalize(wi);normalize(wj);const impact=Number(calculateResults(wi)[0].name!==base.name)+Number(calculateResults(wj)[0].name!==base.name);
    const key=`criterion:${i}:${j}`;if(!seen.has(key))candidates.push({score:entropy(p)*(1+unc)*(.8+impact),type:'criterion',a:i,b:j,key,strength:Math.abs(p-.5)<.12?1.25:.95,reason:`Their inferred importance is still uncertain, and shifting either criterion changes the decision surface.`});
  }
  const r=calculateResults();for(let x=0;x<r.length;x++)for(let y=x+1;y<r.length;y++){const gap=Math.abs(r[x].utility-r[y].utility);const A=state.learning.optionLatents[r[x].index],B=state.learning.optionLatents[r[y].index];const u=Math.sqrt((A?.variance||.9)+(B?.variance||.9));const key=`option:${r[x].index}:${r[y].index}`;if(!seen.has(key))candidates.push({score:(1/(.05+gap))*(.6+u),type:'option',a:r[x].index,b:r[y].index,key,strength:gap<.06?1.2:.9,reason:`These choices are close enough that a direct preference signal could materially change their order.`})}
  // Semantic carry-over question
  state.decision.criteria.forEach((c,i)=>{const prior=semanticPrior(c.name);if(prior&&prior.similarity>.68&&state.learning.criterionLatents[i].evidence<2){const key=`semantic:${i}`;if(!seen.has(key))candidates.push({score:.9+prior.similarity,type:'semantic',a:i,b:null,key,strength:1.0,reason:`Your saved preference memory suggests a related concept: “${prior.label}”.`})}});
  return candidates.sort((a,b)=>b.score-a.score)[0]||null;
}
function renderLearning(){
  const q=pickQuestion();const n=state.learning.comparisons.length;$('#learningProgressText').textContent=`${n} preference observations recorded`;$('#learningProgressBar').style.width=`${Math.min(100,n*8)}%`;$('#questionChoices').innerHTML='';$('#questionTrace').innerHTML='';
  if(!q){$('#questionTitle').textContent='Learning pass complete';$('#questionReason').textContent='The highest-value unanswered questions are exhausted. You can analyze now or keep adding observations later.';$('#trainingSignals').innerHTML=signalHtml();return}
  const a=q.type==='criterion'||q.type==='semantic'?state.decision.criteria[q.a].name:state.decision.options[q.a].name;const b=q.type==='criterion'?state.decision.criteria[q.b].name:q.type==='option'?state.decision.options[q.b].name:null;
  $('#questionTitle').textContent=q.type==='semantic'?'Does this preference feel relevant here?':'Which matters more to you?';$('#questionReason').textContent=b?`Choose the stronger preference between “${a}” and “${b}”.`: `Your prior learning around “${a}” looks relevant. Confirm whether it should remain important. ${q.reason}`;
