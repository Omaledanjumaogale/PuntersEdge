/** Explicit unpaid provider initialization, using the deploy-key-only owner probe.
 * Never charges a card or submits a bank transfer. Secrets and checkout details stay private. */
import {existsSync} from 'node:fs';import {spawnSync} from 'node:child_process';
if(!process.argv.includes('--initialize-unpaid'))throw Error('Pass --initialize-unpaid to create unpaid diagnostic checkouts for the configured owner.');
for(const path of ['.env.local','.env.production.local'])if(existsSync(path))process.loadEnvFile(path);
let failed=false;
for(const provider of ['flutterwave','korapay']){
 const result=spawnSync(process.execPath,['node_modules/convex/bin/main.js','run','payments:probeCheckout',JSON.stringify({provider})],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 if(result.status!==0){console.log(JSON.stringify({provider,initialized:false,moneyMoved:false,error:'Provider initialization failed; inspect protected payment attempt and backend diagnostics.'}));failed=true;continue;}
 const body=JSON.parse(result.stdout);console.log(JSON.stringify(body));
}
if(failed)process.exitCode=1;
