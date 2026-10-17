import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const root='.svelte-kit/cloudflare';
const routes=JSON.parse(readFileSync(root+'/_routes.json','utf8'));
assert.ok(!routes.include.includes('/*'),'Static page requests must not invoke a Function');
for(const route of ['','board','login','tester','match','tennis','betslips','admin','admin/members','admin/models']){
 const path=route||'index';
 const html=existsSync(`${root}/${path}.html`)?`${root}/${path}.html`:`${root}/${path}/index.html`;
 assert.ok(existsSync(html),`Missing static application shell: /${route}`);
 assert.match(readFileSync(html,'utf8'),/PuntersEdge/);
}
assert.ok(existsSync(root+'/404.html'),'Quota fallback must have an application shell');
assert.match(readFileSync(root+'/404.html','utf8'),/Open board/,'Fallback must offer recovery navigation');
assert.ok(routes.include.some(r=>r==='/api/*'),'API requests retain server authorization');
console.log('Static page shells, fallback and API routing checks passed.');
