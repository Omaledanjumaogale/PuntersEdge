/** Authorized hosted configuration. Reads credentials only from injected environment. */
import { spawnSync } from 'node:child_process';
const required = name => { if (!process.env[name]) throw new Error(`Missing ${name}`); return process.env[name]; };
const account = required('CLOUDFLARE_ACCOUNT_ID');
if (!/^[a-f0-9]{32}$/.test(account)) throw new Error('Invalid Cloudflare account ID.');
const cfToken = required('CLOUDFLARE_API_TOKEN');
const resendToken = required('PUNTERSEDGE_RESEND_API_KEY');
const mailDomain = 'ewinproject.org';
const domain = 'puntersedge.ewinproject.org', project = 'puntersedge';
async function api(base, path, token, method = 'GET', body) {
 const response = await fetch(base + path, {method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','User-Agent':'PuntersEdge/1.0'},body:body ? JSON.stringify(body) : undefined,signal:AbortSignal.timeout(20000)});
 const data=await response.json();
 if (!response.ok || data.success === false) throw new Error(`${new URL(base).hostname}: ${method} request failed (${response.status}); response withheld to protect sensitive configuration.`);
 return data;
}
const cf=(path,method,body)=>api('https://api.cloudflare.com/client/v4',path,cfToken,method,body);
const resend=(path,method,body)=>api('https://api.resend.com',path,resendToken,method,body);
// Verify access before making changes. Preserve existing project configuration.
const current=(await cf(`/accounts/${account}/pages/projects/${project}`)).result;
const zones=(await cf(`/zones?name=ewinproject.org&account.id=${account}`)).result;
if(zones.length!==1)throw new Error('Exactly one authorized ewinproject.org DNS zone is required.');
const zone=zones[0].id;
const publicVariables={PUBLIC_CONVEX_URL:'https://reliable-duck-539.eu-west-1.convex.cloud',PUBLIC_CONVEX_SITE_URL:'https://reliable-duck-539.eu-west-1.convex.site',PUBLIC_SITE_URL:`https://${domain}`};
const deployment_configs={};
for(const target of ['production','preview']) {
 const env_vars={...current.deployment_configs?.[target]?.env_vars};
 for(const [key,value] of Object.entries(publicVariables))env_vars[key]={type:'plain_text',value};
 deployment_configs[target]={...current.deployment_configs?.[target],env_vars};
}
await cf(`/accounts/${account}/pages/projects/${project}`,'PATCH',{deployment_configs});
const custom=(await cf(`/accounts/${account}/pages/projects/${project}/domains`)).result;
if(!custom.some(d=>d.name===domain))await cf(`/accounts/${account}/pages/projects/${project}/domains`,'POST',{name:domain});
async function dns(record) {
 const existing=(await cf(`/zones/${zone}/dns_records?name=${encodeURIComponent(record.name)}`)).result;
 const same=existing.find(r=>r.type===record.type && r.content===record.content);
 if(same)return;
 // Keep user-controlled DNS records; never replace unrelated records silently.
 if(existing.some(r=>r.type===record.type) || record.type==='CNAME' && existing.length)throw new Error(`DNS conflict for ${record.name}; review existing records.`);
 await cf(`/zones/${zone}/dns_records`,'POST',{type:record.type,name:record.name,content:record.content,ttl:record.ttl??3600,proxied:false,...(record.priority!==undefined?{priority:record.priority}:{})});
}
await dns({type:'CNAME',name:domain,content:`${project}.pages.dev`});
let mail=(await resend('/domains')).data?.find(d=>d.name===mailDomain);
if(!mail)mail=await resend('/domains','POST',{name:mailDomain,region:'eu-west-1'});
const details=await resend(`/domains/${mail.id}`);
if(details.status!=='verified'){
for(const r of details.records??[])await dns({type:r.type,name:r.name===mailDomain || r.name.endsWith(`.${mailDomain}`)?r.name:r.name==='@'?mailDomain:`${r.name}.${mailDomain}`,content:r.value,priority:r.priority});
await resend(`/domains/${mail.id}/verify`,'POST',{});
}
console.log('Pages public variables and domain configured; Resend DNS verification requested. Verification may take time.');
const repository='Omaledanjumaogale/PuntersEdge';
const secrets=['CONVEX_DEPLOY_KEY','BETTER_AUTH_SECRET','API_SPORTS_KEY','THE_ODDS_API_KEY','ODDSPAPI_KEY','AGNES_AI_KEY','AIHUBMIX_API_KEY','PUNTERSEDGE_RESEND_API_KEY','FLW_SECRET_KEY','FLW_SECRET_HASH','CLOUDFLARE_API_TOKEN','VAPID_PRIVATE_KEY'];
for(const name of secrets) {
 if(!process.env[name])continue;
 const result=spawnSync('gh',['secret','set',name,'--repo',repository],{input:process.env[name],stdio:['pipe','pipe','pipe']});
 if(result.status!==0)throw new Error(`GitHub secret ${name} could not be set; check Actions secret write access.`);
 console.log(`Configured GitHub secret ${name}`);
}
const variables={SITE_URL:`https://${domain}`,RESEND_FROM_EMAIL:`PuntersEdge <puntersedge@${mailDomain}>`,CLOUDFLARE_ACCOUNT_ID:account};
for(const name of ['AGNES_AI_MODEL','AIHUBMIX_BASE_URL','SUPER_ADMIN_USER_ID','PUBLIC_VAPID_KEY'])if(process.env[name])variables[name]=process.env[name];
for(const [name,value] of Object.entries(variables)) {
 const result=spawnSync('gh',['variable','set',name,'--repo',repository,'--body',value],{stdio:['ignore','pipe','pipe']});
 if(result.status!==0)throw new Error(`GitHub variable ${name} could not be set.`);
 console.log(`Configured GitHub variable ${name}`);
}
console.log('Hosted configuration complete. Verify Resend domain status before deploying required email flows.');
