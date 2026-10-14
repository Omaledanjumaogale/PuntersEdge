import {ConvexHttpClient} from 'convex/browser';
import {anyApi} from 'convex/server';
import {readFileSync,readdirSync} from 'node:fs';
const client=new ConvexHttpClient(process.env.PUBLIC_CONVEX_URL);
client.setAdminAuth(process.env.CONVEX_DEPLOY_KEY);
const artifacts=readdirSync('training/artifacts').filter(n=>n.endsWith('.json')).map(n=>JSON.parse(readFileSync(`training/artifacts/${n}`,'utf8')));
for(const n of readdirSync('training/period-artifacts').filter(n=>n.endsWith('.json'))){const a=JSON.parse(readFileSync(`training/period-artifacts/${n}`,'utf8'));if(a.scope!=='full')artifacts.push(a);}
console.log(JSON.stringify(await client.mutation(anyApi.models.installCandidates,{artifacts})));
