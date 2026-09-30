const STORAGE_KEY = 'decisionLab.v2';
const FEATURE_DIM = 96;
const SYNONYMS = {
  cost:['cost','price','budget','expense','fee','affordability'],
  performance:['performance','speed','power','throughput','capacity'],
  reliability:['reliability','durability','stability','dependability','uptime','quality'],
  battery:['battery','runtime','power','efficiency','endurance'],
  portability:['portable','portability','weight','light','compact','mobility'],
  quality:['quality','craft','build','finish','materials'],
  safety:['safety','security','risk','protection'],
  flexibility:['flexibility','adaptability','versatility','customization'],
  support:['support','service','maintenance','help','warranty'],
  speed:['speed','latency','response','quickness'],
  comfort:['comfort','ergonomic','ease','convenience'],
  aesthetics:['design','appearance','looks','style','aesthetic'],
  growth:['growth','learning','development','upside','progress'],
  social:['community','social','team','network','people'],
  location:['location','distance','commute','travel','proximity'],
};

const state = {
  decision:{name:'',context:'',horizon:'medium',risk:'balanced',options:[{name:'Option A'},{name:'Option B'},{name:'Option C'}],criteria:[{name:'Cost',direction:'lower'},{name:'Quality',direction:'higher'},{name:'Reliability',direction:'higher'}],scores:{}},
  learning:{comparisons:[],criterionLatents:{},optionLatents:{},seenQuestions:[],conceptMemory:{},globalSignals:{},outcomes:[]},
  history:[], scenarios:[], simulation:null
};

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=v=>`${Math.round(v)}%`;
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const now=()=>new Date().toISOString();
const sigmoid=x=>1/(1+Math.exp(-x));
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));updateHeaderStats();}
function load(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY));if(x){Object.assign(state,x);state.learning=state.learning||{};state.learning.comparisons??=[];state.learning.criterionLatents??={};state.learning.optionLatents??={};state.learning.seenQuestions??=[];state.learning.conceptMemory??={};state.learning.globalSignals??={};state.learning.outcomes??=[];state.history??=[];state.scenarios??=[];}}catch(e){console.warn(e)}}
function updateHeaderStats(){
  $('#questionCount').textContent=state.learning.comparisons.length;
  $('#decisionCount').textContent=state.history.length;
  $('#conceptCount').textContent=Object.keys(state.learning.conceptMemory||{}).length;
  $('#learningStatus').textContent=state.learning.comparisons.length>8?'Adaptive model trained':'Local model ready';
}
function esc(s=''){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
