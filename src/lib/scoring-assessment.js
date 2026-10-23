import {evidenceMarket} from './evidence-shortlist.js';
/** @param {number} p */
const clamp=p=>Math.max(1e-6,Math.min(1-1e-6,p));
/** @param {number} p @param {number} t */
export const temper=(p,t)=>1/(1+Math.exp(-Math.log(clamp(p)/(1-clamp(p)))/t));
/** Frozen publications only. Repeated lines contribute one averaged loss per fixture, not fake independent samples. @param {any[]} fixtures @param {number} now */
export function scoringAssessment(fixtures,now=Date.now()){
 const groups=new Map(),seen=new Set();
 for(const f of [...fixtures].sort((a,b)=>b.publishedAt-a.publishedAt)){
  if(!['football','basketball','nba'].includes(f.sport)||f.state!=='finished'||!f.score||!(f.publishedAt<f.kickoff)||!(f.finishedAt<=now))continue;
  for(const r of f.rows??[]){const m=evidenceMarket(r.key,f.sport);if(!m||!['won','lost'].includes(r.result)||!Number.isFinite(r.modelProb)||r.modelProb<=0||r.modelProb>=1)continue;
   const family=['bttsYes','bttsNo'].includes(m.side)?'btts':m.kind;if(!['btts','match-total','team-home','team-away','handicap'].includes(family))continue;
   // Use one orientation of each complementary pair; the opposite has identical proper-score loss.
   if(family==='btts'?m.side!=='bttsYes':family==='handicap'?m.side!=='home':m.side!=='over')continue;
   const identity=JSON.stringify([f.sport,f.matchTitle,f.kickoff,m.signature]);if(seen.has(identity))continue;seen.add(identity);
   const key=JSON.stringify([f.sport,f.version,r.artifact,r.source,m.scope,family]);if(!groups.has(key))groups.set(key,{sport:f.sport,version:f.version,artifact:r.artifact,source:r.source,scope:m.scope,family,fixtures:new Map()});const g=groups.get(key);if(!g.fixtures.has(f.fixtureId))g.fixtures.set(f.fixtureId,{id:f.fixtureId,kickoff:f.kickoff,availableAt:f.finishedAt,rows:[]});g.fixtures.get(f.fixtureId).rows.push({p:r.modelProb,y:Number(r.result==='won')});
  }
 }
 /** @param {any} f @param {number} t @param {boolean} log */
 const loss=(f,t,log=false)=>f.rows.reduce((/** @type {number} */n,/** @type {any} */r)=>n+(log?-(r.y*Math.log(clamp(temper(r.p,t)))+(1-r.y)*Math.log(1-clamp(temper(r.p,t)))):(temper(r.p,t)-r.y)**2),0)/f.rows.length;
 const segments=[];
 for(const g of groups.values()){
  const fs=[...g.fixtures.values()].sort((a,b)=>a.kickoff-b.kickoff),boundary=fs[Math.floor(fs.length*.7)]?.kickoff??now,train=fs.filter((/** @type {any} */f)=>f.kickoff<boundary&&f.availableAt<boundary),test=fs.filter((/** @type {any} */f)=>f.kickoff>=boundary),average=(/** @type {any[]} */xs,/** @type {(f:any)=>number} */fn)=>xs.length?xs.reduce((n,f)=>n+fn(f),0)/xs.length:null;
  let temperature=1;if(train.length>=60)for(const t of [.6,.8,1,1.2,1.5,2])if((average(train,(/** @type {any} */f)=>loss(f,t))??Infinity)<(average(train,(/** @type {any} */f)=>loss(f,temperature))??Infinity))temperature=t;
  const differences=test.map((/** @type {any} */f)=>loss(f,temperature)-loss(f,1)),mean=average(test,(/** @type {any} */f)=>loss(f,temperature)-loss(f,1)),se=mean===null||test.length<2?null:Math.sqrt(differences.reduce((n,d)=>n+(d-(mean??0))**2,0)/(test.length-1)/test.length),upper=se===null?null:(mean??0)+1.96*se;
  const reasons=[];if(train.length<100)reasons.push('Need 100 earlier independent fixtures');if(test.length<40)reasons.push('Need 40 later independent fixtures');if(new Set(test.map((/** @type {any} */f)=>Math.floor(f.kickoff/86400000))).size<14)reasons.push('Need validation across 14 days');if(temperature===1)reasons.push('Identity calibration retained');if(upper===null||upper>=0)reasons.push('No reliable fixture-block Brier improvement');if(test.length&&(average(test,(/** @type {any} */f)=>loss(f,temperature,true))??Infinity)>(average(test,(/** @type {any} */f)=>loss(f,1,true))??Infinity))reasons.push('Log loss regression');
  const bins=Array.from({length:10},(_,i)=>{const rows=fs.flatMap((/** @type {any} */f)=>f.rows.map((/** @type {any} */r)=>({...r,id:f.id}))).filter((/** @type {any} */r)=>Math.min(9,Math.floor(r.p*10))===i);return {lower:i*10,options:rows.length,fixtures:new Set(rows.map((/** @type {any} */r)=>r.id)).size,wins:rows.reduce((n,r)=>n+r.y,0),meanModel:rows.length?rows.reduce((n,r)=>n+r.p,0)/rows.length:null,observed:rows.length?rows.reduce((n,r)=>n+r.y,0)/rows.length:null};}).filter((/** @type {any} */b)=>b.options);
  const {fixtures,...identity}=g;segments.push({...identity,nFixtures:fs.length,trainN:train.length,testN:test.length,testStart:boundary,temperature,candidateBrier:average(test,(/** @type {any} */f)=>loss(f,temperature)),publishedBrier:average(test,(/** @type {any} */f)=>loss(f,1)),candidateLogLoss:average(test,(/** @type {any} */f)=>loss(f,temperature,true)),publishedLogLoss:average(test,(/** @type {any} */f)=>loss(f,1,true)),pairedUpper95:upper,status:reasons.length?'Published model retained':'Calibration candidate passed; prospective validation required',reasons,bins});
 }
 return {schema:1,evaluatedAt:now,policy:'Archived pre-match probabilities, verified binary outcomes, earlier available training labels, later chronological fixture holdout; symmetric temperature candidates remain shadow; no prices/ROI invented',segments,coverage:{firstHalfEventMarkets:'Not enabled: no validated archived first-half shots/fouls/goal-kicks/throw-ins dataset'}};
}
