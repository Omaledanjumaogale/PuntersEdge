import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {parseGames} from '../src/lib/feeds/apisports.js';
import {SPORTS} from '../src/lib/feeds/catalog.js';
import {historyFetch} from './history-budget.mjs';
const key=process.env.API_FOOTBALL_KEY;
const jobs=[['football','2022','/fixtures?league=39&season=2022'],['football','2023','/fixtures?league=39&season=2023'],['nba','2023','/games?season=2023'],['hockey','2023','/games?league=57&season=2023'],['baseball','2023','/games?league=1&season=2023']];
const manifest=JSON.parse(readFileSync('training/private/collection-manifest.json','utf8'));
for(const [sport,season,path] of jobs){
 if(existsSync(`training/private/${sport}-${season}-provider.json`)){console.log(`${sport} ${season}: cached; skipped`);continue;}
 const existing=manifest.find(x=>x.sport===sport&&x.usedBefore<65);if(!existing){console.log(`${sport}: not enough verified quota`);continue;}
 try{const r=await historyFetch(SPORTS[sport].host,path,key);const raw=await r.text(),b=JSON.parse(raw);const games=parseGames(sport,b).filter(g=>g.status.state==='finished'&&Number.isFinite(g.status.home)&&Number.isFinite(g.status.away));writeFileSync(`training/private/${sport}-${season}-provider.json`,raw);writeFileSync(`training/private/${sport}-${season}-games.json`,JSON.stringify(games,null,2));manifest.push({sport,season,path,observedAt:new Date().toISOString(),requests:2,games:games.length,errors:b.errors??{}});console.log(JSON.stringify(manifest.at(-1)));}catch{console.log(`${sport}: failed or quota reserved; no retries`);}
}
if(!existsSync('training/private/basketball-leagues.json')){const r=await historyFetch(SPORTS.basketball.host,'/leagues',key);const body=await r.json();writeFileSync('training/private/basketball-leagues.json',JSON.stringify(body));}
writeFileSync('training/private/collection-manifest.json',JSON.stringify(manifest,null,2));
