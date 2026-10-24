import {basketballTeamNames} from './basketball-team-names.js';
import {teamKey} from '../feeds/matching.js';
import {LEAGUE_PROFILES} from './basketball_model.js';
/** Versioned, administrator-reviewed artifacts. Import never implies approval. */
/** @param {any} a */
export function validateArtifact(a) {
 if(!a||!['football','nba','basketball','hockey','baseball'].includes(a.sport)||typeof a.version!=='string'||!a.version.trim()||typeof a.league!=='string'||!a.league.trim())throw new Error('Invalid model identity');
 const t=Date.parse(a.trainedThrough);if(!Number.isFinite(t)||t>=Date.now())throw new Error('Invalid training cutoff');
 if(!a.teams||typeof a.teams!=='object'||Object.keys(a.teams).length<2)throw new Error('At least two mapped teams required');
 if(a.scope!==undefined&&!['full','first_half','first_quarter','first_period','regulation','first_five','first_inning'].includes(a.scope))throw new Error('Unsupported period');
 const scopes=/** @type {Record<string,string[]>} */({football:['full','first_half'],nba:['full','first_half','first_quarter'],basketball:['full','first_half','first_quarter'],hockey:['full','first_period','regulation'],baseball:['full','first_five','first_inning']});
 if(!scopes[a.sport].includes(a.scope??'full'))throw new Error('Period incompatible with sport');
 if(a.scope&&a.scope!=='full'&&['nba','basketball'].includes(a.sport)&&(!Number.isFinite(a.teamSd)||a.teamSd<=0))throw new Error('Period team dispersion required');
 for(const team of Object.values(a.teams))if(!Number.isFinite(/** @type {any} */(team).attack)||!Number.isFinite(/** @type {any} */(team).defence))throw new Error('Invalid team parameters');
 if(![a.intercept,a.homeAdvantage].every(Number.isFinite))throw new Error('Invalid fitted parameters');
 if(a.sport==='football' && !Number.isFinite(a.rho))throw new Error('Invalid dependence');
 if(a.modelWeight!==undefined&&(!Number.isFinite(a.modelWeight)||a.modelWeight<0||a.modelWeight>1))throw new Error('Invalid ensemble weight');
 if(a.scoreConfig){const c=a.scoreConfig;const supported=(a.sport==='hockey'&&c.distribution==='poisson')||(a.sport==='baseball'&&c.distribution==='negbin'&&Number.isFinite(c.dispersion)&&c.dispersion>0&&c.dispersion<=100);if(!supported||c.finalScoreModel!==(a.scope===undefined||a.scope==='full')||Object.keys(c).some(k=>!['distribution','dispersion','finalScoreModel'].includes(k)))throw new Error('Unsupported score model configuration');}
 if(['nba','basketball'].includes(a.sport)&&(![a.marginSd,a.totalSd].every(x=>Number.isFinite(x)&&x>0)))throw new Error('Dispersion required');
 return a;
}
/** @param {any} input @param {any} game @param {any[]} records @param {number} now */
export function fittedInput(input,game,records,now) {
 // Resolve only the trained competition; never transfer NBA parameters to other leagues.
 const leagueMatch=(/** @type {any} */a)=>a?.league?.toLowerCase()===String(game.league).toLowerCase();
 if(game.sport==='basketball'&&String(game.league).toLowerCase()==='euroleague'){
  const aliases=/** @type {Record<string,string>} */({'kk partizan belgrade':'Partizan','kk partizan nis':'Partizan','kk crvena zvezda belgrade':'Crvena zvezda','kk crvena zvezda':'Crvena zvezda','bc olympiakos piraeus':'Olympiacos','panathinaikos bc':'Panathinaikos','valencia basket':'Valencia','baskonia vitoria-gasteiz':'Baskonia','saski baskonia':'Baskonia','bayern munich':'Bayern','fc barcelona':'Barcelona'});
  const resolve=(/** @type {string} */name,/** @type {any} */id)=>{const key=teamKey(aliases[String(name).toLowerCase()]??name),matches=Object.entries(basketballTeamNames).filter(([,n])=>teamKey(n)===key);return id??(matches.length===1?matches[0][0]:undefined);};
  game={...game,homeId:resolve(game.home,game.homeId),awayId:resolve(game.away,game.awayId)};
 }
 input.homeId=game.homeId;input.awayId=game.awayId;
 input.periodArtifacts=records.filter(r=>r.artifact?.sport===game.sport&&leagueMatch(r.artifact)&&r.mode==='active'&&r.artifact.scope&&r.artifact.scope!=='full'&&Date.parse(r.artifact.trainedThrough)<now).map(r=>r.artifact).filter(a=>{try{validateArtifact(a);return true;}catch{return false;}});
 // Version the prospective line policy only where a mapped period artifact can serve.
 if(['football','basketball','nba'].includes(game.sport)&&input.periodArtifacts.some((/** @type {any} */a)=>a.teams[String(game.homeId)]&&a.teams[String(game.awayId)]))input.periodLinePolicy='alternatives-v2';
 const record=records.find(r=>r.artifact?.sport===game.sport&&leagueMatch(r.artifact)&&r.mode==='active'&&(!r.artifact.scope||r.artifact.scope==='full'));
 if(!record)return input;
 const a=record.artifact;
 try {validateArtifact(a);} catch {return input;}
 if(Date.parse(a.trainedThrough)>=now)return input;
 const h=a.teams[String(game.homeId)],w=a.teams[String(game.awayId)];
 if(!h||!w)return input;
 let home,away;
 if(a.sport==='football'||a.sport==='hockey'||a.sport==='baseball'){
  home=Math.exp(a.intercept+a.homeAdvantage+h.attack+w.defence);away=Math.exp(a.intercept+w.attack+h.defence);
  if(!Number.isFinite(home+away)||home<=0||away<=0)return input;
  if(a.sport==='football'){
   if(home>12||away>12||home<.05||away<.05||Math.min(1-home*away*a.rho,1+home*a.rho,1+away*a.rho,1-a.rho)<=0)return input;
   input.ratings={lambdaHome:home,muAway:away,rho:a.rho};
  }
  else {input.ratings={homeMean:home,awayMean:away};input.scoreConfig=a.scoreConfig;}
 }else {
  home=a.intercept+a.homeAdvantage+h.attack+w.defence;away=a.intercept+w.attack+h.defence;
  if(home<=0||away<=0)return input;
  input.fittedProjection={home,away,marginSd:a.marginSd,totalSd:a.totalSd};
  if(!input.ratings){const league=a.sport==='nba'?LEAGUE_PROFILES.NBA:LEAGUE_PROFILES.EuroLeague;input.ratings={home:{pace:league.pace,offRtg:100*home/league.pace,defRtg:league.offRtg},away:{pace:league.pace,offRtg:100*away/league.pace,defRtg:league.offRtg}};input.paceBasis='League prior; scoring rates inferred from fitted score means';}
 }
 input.ratingsSource=`Fitted ${a.version} · ${a.trainingCount} completed games`;
 // A fixture needs two team parameters, not a duplicate of the entire league model.
 const forFixture=(/** @type {any} */a)=>({...a,teams:Object.fromEntries([game.homeId,game.awayId].filter(id=>a.teams[String(id)]).map(id=>[String(id),a.teams[String(id)]]))});
 input.modelArtifact=forFixture(a);
 input.periodArtifacts=input.periodArtifacts.map(forFixture);
 input.analysisEvidence={approved:record.approved===true,independent:true,domainSupported:record.approved===true,approvedMarkets:record.approvedMarkets??[],modelVersion:a.version,trainedThrough:a.trainedThrough,trainingCount:a.trainingCount};
 return input;
}
