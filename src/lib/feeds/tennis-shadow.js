/** Isolated discovery: only documented zero-credit catalogue and event endpoints. */
/** @typedef {{at:number;provider:string;competitions:{key:string;title:string;active:boolean}[];events:{id:string;sportKey:string;playerA:string;playerB:string;startedAt:number}[];requests:number;chargedCredits:number;errors:string[]}} Coverage */
/** @param {string} key @param {{fetcher?:typeof fetch}} [options] */
export async function discoverTennis(key,{fetcher=fetch}={}){
 /** @type {Coverage} */
 const result={at:Date.now(),provider:'The Odds API',competitions:[],events:[],requests:0,chargedCredits:0,errors:[]};
 if(!key){result.errors.push('Tennis discovery credential is not configured');return result;}
 const get=async(/** @type {string} */ path)=>{if(!/^\/v4\/sports(?:\/tennis_[a-z0-9_]+\/events)?$/.test(path))throw Error('Only quota-free tennis discovery is allowed');const url=new URL(path,'https://api.the-odds-api.com');url.searchParams.set('apiKey',key);if(path==='/v4/sports')url.searchParams.set('all','true');result.requests++;const response=await fetcher(url,{signal:AbortSignal.timeout(20000)});const cost=Number(response.headers.get('x-requests-last')??0);if(cost>0){result.chargedCredits+=cost;throw Error('Discovery reported an unexpected charge; further requests stopped');}if(!response.ok)throw Error('Tennis discovery returned HTTP '+response.status);return response.json();};
 try{const sports=await get('/v4/sports');if(!Array.isArray(sports))throw Error('Invalid sport catalogue');result.competitions=sports.filter(s=>/^tennis_[a-z0-9_]+$/.test(s.key)).map(s=>({key:s.key,title:String(s.title).slice(0,100),active:s.active===true}));for(const sport of result.competitions.filter(s=>s.active).slice(0,2)){const events=await get('/v4/sports/'+sport.key+'/events');if(!Array.isArray(events))continue;for(const e of events.slice(0,100)){if(typeof e.id==='string'&&typeof e.home_team==='string'&&typeof e.away_team==='string'&&Number.isFinite(Date.parse(e.commence_time)))result.events.push({id:e.id,sportKey:sport.key,playerA:e.home_team,playerB:e.away_team,startedAt:Date.parse(e.commence_time)});}}}catch(e){result.errors.push((e instanceof Error?e.message:String(e)).replaceAll(key,'[redacted]').slice(0,200));}
 return result;
}
/** Normalize period scores without inferring match format, retirement rules or service statistics. */
/** @param {any} fixture @param {any} body */
export function normalizeTennisScores(fixture,body){
 const raw=body?.scores?.periods??body?.scores??{};
 const state=String(fixture?.statusName??'').toLowerCase();const status=/^finished$/.test(state)?'completed':/^retired$/.test(state)?'retired':/^cancelled$/.test(state)?'cancelled':/^walkover$/.test(state)?'walkover':'pending';
 const valid=(/** @type {any} */s)=>s&&Number.isInteger(s.participant1Score)&&Number.isInteger(s.participant2Score)&&s.participant1Score>=0&&s.participant2Score>=0;
 const sets=Object.entries(raw).filter(([key,s])=>/^(?:p)?[1-5]$/.test(key)&&valid(s)).sort(([a],[b])=>Number(a.replace('p',''))-Number(b.replace('p',''))).map(([,s])=>({a:s.participant1Score,b:s.participant2Score}));
 const total=raw.result??raw.fulltime??raw['0'];
 return {fixtureId:String(fixture?.fixtureId??''),status,sets,reportedSets:valid(total)?{a:total.participant1Score,b:total.participant2Score}:null,servicePointStatisticsAvailable:false,rulesKnown:false};
}
