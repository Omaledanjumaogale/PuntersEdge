// Keep provider credentials in process memory; never log or persist their values.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli=fileURLToPath(new URL('../node_modules/convex/bin/main.js',import.meta.url));
let key=process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY;
if(!key) {
 for(const name of ['API_SPORTS_KEY','API_FOOTBALL_KEY']) {
  try {key=execFileSync(process.execPath,[cli,'env','get',name,'--deployment','reliable-duck-539'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}).trim();if(key)break;} catch { /* do not output CLI errors that might include credentials */ }
 }
}
if(!key){console.log(JSON.stringify({available:false,reason:'Provider credential unavailable from local environment and authenticated Convex deployment.'}));process.exitCode=2;}
else {
 try {const r=await fetch('https://v3.football.api-sports.io/status',{headers:{'x-apisports-key':key},signal:AbortSignal.timeout(15000)});const b=await r.json();console.log(JSON.stringify({available:r.ok && !Object.keys(b.errors??{}).length,status:r.status,subscription:b.response?.subscription,requests:b.response?.requests,errors:b.errors}));}
 catch {console.log(JSON.stringify({available:false,reason:'Provider status request failed.'}));process.exitCode=2;}
}
