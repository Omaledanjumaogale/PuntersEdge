import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {parseGames} from '../src/lib/feeds/apisports.js';
import {historyFetch} from './history-budget.mjs';
const manifest=JSON.parse(readFileSync('training/private/collection-manifest.json','utf8'));
for(const season of [2023,2024]){
 if(existsSync(`training/private/basketball-${season}-provider.json`)){console.log(`basketball ${season}: cached; skipped`);continue;}
 const r=await historyFetch('v1.basketball.api-sports.io',`/games?league=120&season=${season}`,process.env.API_FOOTBALL_KEY);const b=await r.json();
 const games=parseGames('basketball',b).filter(g=>g.status.state==='finished'&&Number.isFinite(g.status.home)&&Number.isFinite(g.status.away));
 writeFileSync(`training/private/basketball-${season}-provider.json`,JSON.stringify(b));writeFileSync(`training/private/basketball-${season}-games.json`,JSON.stringify(games));
 manifest.push({sport:'basketball',season,observedAt:new Date().toISOString(),requests:2,games:games.length,errors:b.errors??{}});console.log(JSON.stringify(manifest.at(-1)));
}
writeFileSync('training/private/collection-manifest.json',JSON.stringify(manifest,null,2));
