const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const base=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/puntersedge`;
async function get(path=''){const r=await fetch(base+path,{headers:{Authorization:`Bearer ${token}`}});const j=await r.json();if(!j.success)throw new Error(JSON.stringify(j.errors));return j.result;}
const project=await get();console.log(JSON.stringify({project:project.name,productionBranch:project.production_branch,build:project.build_config,source:project.source?.config}));
const deployments=await get('/deployments');for(const d of deployments.slice(0,3)){console.log(JSON.stringify({id:d.id,url:d.url,environment:d.environment,stage:d.latest_stage,commit:d.deployment_trigger?.metadata?.commit_hash}));if(d.latest_stage?.status==='failure'){const log=await get(`/deployments/${d.id}/history/logs`);console.log(JSON.stringify({deployment:d.id,logs:log.data?.map(x=>x.line).slice(-35)}));}}
