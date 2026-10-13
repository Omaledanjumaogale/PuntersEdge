#!/usr/bin/env node
import webpush from 'web-push';
import { spawnSync } from 'node:child_process';
if(!process.argv.includes('--apply')){ console.log('Run with --apply to configure VAPID directly in the selected Convex deployment. No private keys are printed.');process.exit(0); }
function convex(args,input){return spawnSync('./node_modules/.bin/convex',args,{encoding:'utf8',input,stdio:[input === undefined ? 'ignore' : 'pipe','pipe','pipe']});}
const present={};
for(const name of ['PUBLIC_VAPID_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT']){
 const result=convex(['env','get',name]);
 if(result.status!==0) throw new Error(`Could not inspect ${name}; no configuration was changed.`);
 if(result.stdout.trim()) present[name]=true;
 else if(result.stderr.includes(`Environment variable "${name}" not found`)) present[name]=false;
 else throw new Error(`Could not determine ${name} presence; no configuration was changed.`);
}
const has=(name)=>present[name];
if(has('PUBLIC_VAPID_KEY') !== has('VAPID_PRIVATE_KEY')) throw new Error('Partial VAPID configuration exists. Restore the matching key pair securely before continuing.');
if(!has('PUBLIC_VAPID_KEY')) {
 const keys=webpush.generateVAPIDKeys();
 if(convex(['env','set','--from-file','/dev/stdin'],`VAPID_PRIVATE_KEY=${keys.privateKey}\nPUBLIC_VAPID_KEY=${keys.publicKey}\n`).status!==0) throw new Error('Could not configure the VAPID pair; no existing keys were intentionally overwritten.');
}
if(!has('VAPID_SUBJECT') && convex(['env','set','VAPID_SUBJECT','mailto:puntersedge@ewinproject.org']).status!==0) throw new Error('Could not configure VAPID_SUBJECT.');
console.log('Convex VAPID configuration is ready. Existing key pairs were preserved.');
