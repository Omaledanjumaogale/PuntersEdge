import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const query='const rows=await ctx.db.query("projection_snapshots").order("desc").take(500); const metrics=await ctx.db.query("performance_metrics").take(10); return {rows:await Promise.all(rows.map(async r=>({...r,url:await ctx.storage.getUrl(r.storageId)}))),metrics};';
try {
 const raw=execFileSync(process.execPath,['node_modules/convex/bin/main.js','run','--inline-query',query,'--url',process.env.PUBLIC_CONVEX_URL,'--admin-key',process.env.CONVEX_DEPLOY_KEY],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:90000,maxBuffer:64*1024*1024});
 const data=JSON.parse(raw),snapshots=[];
 for(const row of data.rows){if(!row.url)continue;const r=await fetch(row.url,{signal:AbortSignal.timeout(20000)});if(!r.ok)continue;snapshots.push(JSON.parse(gunzipSync(Buffer.from(await r.arrayBuffer())).toString()));}
 mkdirSync('training/private',{recursive:true});
 const bytes=JSON.stringify({exportedAt:new Date().toISOString(),metrics:data.metrics,snapshots},null,2);
 writeFileSync('training/private/production-history.json',bytes);
 console.log(JSON.stringify({snapshots:snapshots.length,settled:snapshots.filter(s=>s.score).length,sha256:createHash('sha256').update(bytes).digest('hex'),sports:Object.fromEntries(['football','nba','basketball','hockey','baseball'].map(s=>[s,snapshots.filter(x=>x.sport===s).length]))}));
}catch(e) {let diagnostic=String(e.stderr||e.message||'').slice(0,1500);for(const value of Object.values(process.env))if(value&&value.length>16)diagnostic=diagnostic.split(value).join('[redacted]');console.log(JSON.stringify({available:false,reason:diagnostic}));process.exitCode=1;}
