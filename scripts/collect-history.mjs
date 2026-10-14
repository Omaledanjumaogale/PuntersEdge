import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SPORTS} from '../src/lib/feeds/catalog.js';
import {parseGames} from '../src/lib/feeds/apisports.js';
const key=process.env.API_SPORTS_KEY||process.env.API_FOOTBALL_KEY;
if(!key)throw new Error('Provider key required in local environment');
const requests={football:'/fixtures?league=39&season=2024',nba:'/games?season=2024',basketball:'/games?league=120&season=2024-2025',hockey:'/games?league=57&season=2024',baseball:'/games?league=1&season=2024'};
mkdirSync('training/private',{recursive:true});
const manifest=[];
for(const [sport,path] of Object.entries(requests)){
 if(existsSync(`training/private/${sport}-provider.json`)){manifest.push({sport,skipped:'Cached historical response; no additional quota spent'});continue;}
 const host=SPORTS[sport].host;
 try{
  const s=await fetch(`https://${host}/status`,{headers:{'x-apisports-key':key},signal:AbortSignal.timeout(15000)});
  const status=await s.json(),used=status.response?.requests?.current,limit=status.response?.requests?.limit_day;
  if(!s.ok||!Number.isFinite(used)||limit!==100||used>=70){manifest.push({sport,skipped:'Missing balance or fewer than 30 daily requests reserved',used});continue;}
  const response=await fetch(`https://${host}${path}`,{headers:{'x-apisports-key':key},signal:AbortSignal.timeout(25000)});
  const raw=await response.text(),b=JSON.parse(raw),observedAt=new Date().toISOString();
  const games=parseGames(sport,b).filter(g=>g.status.state==='finished'&&Number.isFinite(g.status.home)&&Number.isFinite(g.status.away));
  writeFileSync(`training/private/${sport}-provider.json`,raw);
  writeFileSync(`training/private/${sport}-games.json`,JSON.stringify(games,null,2));
  manifest.push({sport,path,observedAt,usedBefore:used,maximumChargedRequests:2,pages:b.paging,providerErrors:b.errors??{},games:games.length,sha256:createHash('sha256').update(raw).digest('hex')});
 }catch {manifest.push({sport,error:'Request failed; no retry and no credential logged'});}
}
writeFileSync('training/private/collection-manifest.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));
