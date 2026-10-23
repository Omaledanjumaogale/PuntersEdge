import {settleCorners} from './feeds/performance.js';
import {settleTwoConsecutive} from './engine/goal_sequence.js';
/** Exact-market recurrence analysis of immutable published projections. No model is fitted here. */
/** @param {any} s */
const norm=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}.]+/gu,' ').trim();
export const EVIDENCE_SCHEMA=1;
/** @param {number} p */
export function probabilityBand(p){return Math.min(9,Math.floor(p*10));}
/** @param {any} source */
export function sourceClass(source){const s=String(source??'unknown').toLowerCase();return s.includes('retained recent')?'recent-results':s.includes('market')?'market':s.includes('table')?'table':s.includes('fit')||s.includes('trained')?'fitted':s;}
/** Canonical outcome and exact line; aliases never merge different settlement scopes. */
/** @param {string} key @param {string} sport @returns {any} */
export function evidenceMarket(key,sport){
 let scope='full',kind='',side='',line=null,m;
 if((m=/^(?:forecast:full|period:(full|first_half|first_quarter|first_period|regulation|first_five|first_inning)):(total|home|away|handicap):(over|under|home|away):(-?\d+(?:\.\d+)?)$/.exec(key))){scope=m[1]??'full';kind=m[2]==='total'?'match-total':m[2]==='handicap'?'handicap':`team-${m[2]}`;side=m[3];line=Number(m[4]);}
 else if(sport==='football'&&(m=/^corners:regulation:(home|away|total):(over|under):(\d+\.5)$/.exec(key))){scope='regulation';kind='corners';side=m[1]+'-'+m[2];line=Number(m[3]);}
 else if(sport==='football'&&(m=/^sequence:regulation:two-consecutive:(home|away)$/.exec(key))){scope='regulation';kind='two-consecutive';side=m[1];}
 else if(['home','draw','away','homeMl','awayMl'].includes(key)){kind='winner';side=key.replace('Ml','');}
 else if(['regH','regX','regA'].includes(key)){kind='winner';scope='regulation';side={regH:'home',regX:'draw',regA:'away'}[key]??'';}
 else if(['over25','under25'].includes(key)){kind='match-total';side=key==='over25'?'over':'under';line=2.5;}
 else if((m=/^([ou])([\d.]+)$/.exec(key))){kind='match-total';side=m[1]==='o'?'over':'under';line=Number(m[2]);}
 else if((m=/^(?:ah|sp)([ha])(-?[\d.]+)$/.exec(key))){kind='handicap';side=m[1]==='h'?'home':'away';line=Number(m[2]);}
 else if((m=/^t([ha])([\d.]+)$/.exec(key))){kind=m[1]==='h'?'team-home':'team-away';side='over';line=Number(m[2]);}
 else if((m=/^([ha])(05|15)$/.exec(key))){kind=m[1]==='h'?'team-home':'team-away';side='over';line=Number(m[2])/10;}
 else if(['bttsYes','bttsNo','dc1x','dc12','dcx2','dnbh','dnba','csh','csa'].includes(key)){kind='other';side=key;}
 else return null;
 if(line!==null&&(!Number.isFinite(line)||!Number.isInteger(line*4)))return null;
 const title=kind==='corners'?`${side.replace('-',' · ')} ${line} corners`:kind==='two-consecutive'?`${side==='home'?'Home':'Away'} team · two consecutive goals`:kind==='winner'?`${side==='home'?'Home winner':side==='away'?'Away winner':'Draw'}`:kind==='handicap'?`${side==='home'?'Home':'Away'} handicap ${Number(line)>=0?'+':''}${line}`:kind==='other'?({bttsYes:'Both teams score · Yes',bttsNo:'Both teams score · No',dc1x:'Home or draw (1X)',dc12:'Home or away (12)',dcx2:'Away or draw (X2)',dnbh:'Home draw-no-bet',dnba:'Away draw-no-bet',csh:'Home clean sheet',csa:'Away clean sheet'}[side]):`${kind==='match-total'?'Match total':kind==='team-home'?'Home team total':'Away team total'} · ${side==='over'?'Over':'Under'} ${line}`;
 return {scope,kind,side,line,title,signature:JSON.stringify([scope,kind,side,line])};
}
/** @param {number} wins @param {number} n */
export function wilson(wins,n){if(!n)return {low:0,high:1};const p=wins/n,z=1.959963984540054,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return {low:Math.max(0,c-h),high:Math.min(1,c+h)};}
/** @param {any} snapshot @returns {any} */
export function compactEvidence(snapshot){
 if(!snapshot||!Number.isFinite(snapshot.publishedAt)||!Number.isFinite(snapshot.kickoff)||snapshot.publishedAt>=snapshot.kickoff||!Array.isArray(snapshot.selections))return null;
 const map=new Map();
 for(const s of snapshot.selections){const market=evidenceMarket(s.key,snapshot.sport);if(!market||!Number.isFinite(s.modelProb)||s.modelProb<0||s.modelProb>1)continue;
  if(market.kind==='corners'&&snapshot.state==='finished'&&settleCorners(s.key,snapshot.corners)!==s.result)continue;
  if(market.kind==='two-consecutive'&&snapshot.state==='finished'&&settleTwoConsecutive(snapshot.goalSequence,snapshot.score,market.side)!==s.result)continue;
  const row={...market,key:s.key,selection:s.selection,modelProb:s.modelProb,pushProb:s.pushProb??0,result:s.result??null,odds:s.pricing==='quoted'&&s.odds>1?s.odds:0,pricing:s.pricing==='quoted'?'quoted':'unpriced',artifact:s.modelVersion??snapshot.artifactVersion??'unversioned',source:sourceClass(snapshot.input?.ratingsSource),quoteObservedAt:s.quoteObservedAt??null};
  const old=map.get(market.signature);if(!old||old.pricing!=='quoted'&&row.pricing==='quoted')map.set(market.signature,row);
 }
 return {fixtureId:snapshot.fixtureId,sport:snapshot.sport,matchTitle:snapshot.match,league:snapshot.league,tournament:snapshot.tournament??null,country:snapshot.country??null,kickoff:snapshot.kickoff,publishedAt:snapshot.publishedAt,finishedAt:snapshot.finishedAt??snapshot.observedAt??snapshot.kickoff,observedAt:snapshot.observedAt??snapshot.finishedAt??snapshot.publishedAt,version:snapshot.modelVersion??'unversioned',state:snapshot.state,score:snapshot.score??null,rows:[...map.values()]};
}
/** @param {any} f @param {any} row @param {string} [league] */
export function cohortKey(f,row,league='*'){return JSON.stringify([f.sport,f.version,row.artifact,row.source,row.signature,probabilityBand(row.modelProb),league]);}
/** @param {any} f */
const eventKey=f=>JSON.stringify([f.sport==='nba'?'basketball':f.sport,norm(f.matchTitle),Math.floor(f.kickoff/60000)]);
/** @param {any[]} fixtures @param {any[]} upcoming @param {number} [now] */
export function buildEvidenceReport(fixtures,upcoming,now=Date.now()){
 const groups=/** @type {Record<string,any>} */({}),seen=new Set(),events=new Set();let settledOptions=0;
 // Latest published provider copy wins deterministically, before any result is considered.
 for(const f of [...fixtures].sort((a,b)=>b.publishedAt-a.publishedAt||a.fixtureId.localeCompare(b.fixtureId))){if(f.state!=='finished'||f.kickoff>=now||f.finishedAt>now||!f.score)continue;let used=false;
  for(const row of f.rows){if(!['won','lost','push','half-won','half-lost'].includes(row.result))continue;const identity=JSON.stringify([eventKey(f),f.version,row.artifact,row.source,row.signature]);if(seen.has(identity))continue;seen.add(identity);settledOptions++;used=true;
   for(const league of ['*',norm(f.league)||'not recorded']){const key=cohortKey(f,row,league),g=groups[key]??={n:0,won:0,lost:0,push:0,partial:0,modelTotal:0,quotedN:0,quotedProfit:0,examples:[]};g.n++;g.modelTotal+=row.modelProb;if(row.result==='won')g.won++;else if(row.result==='lost')g.lost++;else if(row.result==='push')g.push++;else g.partial++;
    if(row.pricing==='quoted'){g.quotedN++;g.quotedProfit+=row.result==='won'?row.odds-1:row.result==='lost'?-1:row.result==='half-won'?(row.odds-1)/2:row.result==='half-lost'?-.5:0;}
    g.examples.push({fixtureId:f.fixtureId,matchTitle:f.matchTitle,league:f.league,country:f.country,kickoff:f.kickoff,publishedAt:f.publishedAt,selection:row.selection,modelProb:row.modelProb,result:row.result,score:f.score});g.examples.sort((/** @type {any} */a,/** @type {any} */b)=>b.kickoff-a.kickoff);if(g.examples.length>5)g.examples.length=5;
   }
  }if(used)events.add(eventKey(f));
 }
 for(const g of Object.values(groups)){const n=g.won+g.lost;g.binaryN=n;g.strikeRate=n?g.won/n:null;g.interval=wilson(g.won,n);g.meanModel=g.modelTotal/g.n;g.quotedRoi=g.quotedN?g.quotedProfit/g.quotedN:null;delete g.modelTotal;}
 return {schema:EVIDENCE_SCHEMA,coverage:{missingArchives:0,invalidPublications:0},generatedAt:now,historicalFixtures:events.size,settledOptions,cohortCount:Object.keys(groups).length,groups,upcoming:[...upcoming].sort((a,b)=>b.publishedAt-a.publishedAt||a.fixtureId.localeCompare(b.fixtureId)).filter(f=>f.state==='scheduled'&&f.kickoff>now&&f.publishedAt<=now)};
}
/** @param {any} report @param {any} [options] @param {number} [now] @param {Map<string,any>|null} [liveGames] */
export function evidenceShortlist(report,options={},now=Date.now(),liveGames=null){
 const defaults={minModel:.65,minSamples:20,minStrike:.6,minFloor:.5,sameLeague:false,sport:'all',kind:'all',search:'',hours:168};const o={...defaults,...options},rows=[],rejected={belowModel:0,noHistory:0,smallSample:0,belowStrike:0,belowFloor:0,partialSettlement:0},seen=new Set();
 for(const f of report?.upcoming??[]){const live=liveGames?.get(f.fixtureId);if(f.kickoff<=now||f.kickoff>now+o.hours*3600000||live&&live.status.state!=='scheduled'||o.sport!=='all'&&o.sport!==f.sport)continue;
  if(o.search&&!`${f.matchTitle} ${f.league} ${f.tournament??''} ${f.country??''}`.toLowerCase().includes(o.search.toLowerCase()))continue;
  for(const row of f.rows){if(row.line!==null&&!Number.isInteger(row.line*2)){rejected.partialSettlement++;continue;}if(o.scope&&o.scope!=='all'&&row.scope!==o.scope)continue;if(o.kind!=='all'&&!((o.kind==='double-chance'&&['dc1x','dcx2','dc12'].includes(row.side))||(o.kind==='dc1x'||o.kind==='dcx2'||o.kind==='dc12')&&row.side===o.kind||o.kind==='team-15'&&f.sport==='football'&&['team-home','team-away'].includes(row.kind)&&row.side==='over'&&row.line===1.5||o.kind==='team-05'&&f.sport==='football'&&['team-home','team-away'].includes(row.kind)&&row.side==='over'&&row.line===.5||['bttsYes','bttsNo'].includes(o.kind)&&f.sport==='football'&&row.side===o.kind||['basketball-winner','basketball-spread','basketball-total','basketball-team-over','basketball-team-under'].includes(o.kind)&&['basketball','nba'].includes(f.sport)&&(o.kind==='basketball-winner'?row.kind==='winner':o.kind==='basketball-spread'?row.kind==='handicap':o.kind==='basketball-total'?row.kind==='match-total':['team-home','team-away'].includes(row.kind)&&row.side===(o.kind==='basketball-team-over'?'over':'under'))||o.kind==='basketball-team'&&['basketball','nba'].includes(f.sport)&&['team-home','team-away'].includes(row.kind)||['first-half-u15','first-half-u25'].includes(o.kind)&&f.sport==='football'&&row.scope==='first_half'&&row.kind==='match-total'&&row.side==='under'&&row.line===(o.kind==='first-half-u15'?1.5:2.5)||['match-over','match-under'].includes(o.kind)&&row.kind==='match-total'&&row.side===(o.kind==='match-over'?'over':'under')||row.kind===o.kind))continue;if(row.modelProb<o.minModel){rejected.belowModel++;continue;}
   const g=report.groups[cohortKey(f,row,o.sameLeague?(norm(f.league)||'not recorded'):'*')];if(!g){rejected.noHistory++;continue;}if(g.binaryN<o.minSamples){rejected.smallSample++;continue;}if(g.strikeRate<o.minStrike){rejected.belowStrike++;continue;}if(g.interval.low<o.minFloor){rejected.belowFloor++;continue;}
   const id=JSON.stringify([eventKey(f),row.signature]);if(seen.has(id))continue;seen.add(id);rows.push({...f,...row,id:`${f.fixtureId}:${row.key}`,cohort:g,probabilityBand:probabilityBand(row.modelProb),group:`${f.sport} · ${row.scope.replaceAll('_',' ')} · ${row.title}`});
  }
 }
 rows.sort((a,b)=>b.cohort.interval.low-a.cohort.interval.low||b.cohort.strikeRate-a.cohort.strikeRate||b.modelProb-a.modelProb||b.cohort.binaryN-a.cohort.binaryN||a.kickoff-b.kickoff||a.id.localeCompare(b.id));
 return {rows:rows.map((r,i)=>({...r,rank:i+1})),rejected};
}
