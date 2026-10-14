import {execFileSync} from 'node:child_process';
for(const key of ['CONVEX_DEPLOY_KEY','CLOUDFLARE_API_TOKEN']){
 if(!process.env[key])throw new Error(`Missing ${key}`);
 execFileSync('gh',['secret','set',key],{input:process.env[key],stdio:['pipe','pipe','pipe']});
 console.log(`${key}: configured securely`);
}
execFileSync('gh',['variable','set','CLOUDFLARE_ACCOUNT_ID','--body',process.env.CLOUDFLARE_ACCOUNT_ID],{stdio:['ignore','pipe','pipe']});
console.log('Cloudflare account binding configured');
