import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
test('page CSP includes exact inline hashes within Cloudflare limits and is idempotent',()=>{
 const root=mkdtempSync(join(tmpdir(),'pe-csp-'));
 try{
  writeFileSync(join(root,'_headers'),"/*\n  Content-Security-Policy: base-uri 'self'\n");
  const script='window.example="approved";';
  writeFileSync(join(root,'index.html'),'<script>'+script+'</script><script src="/app.js"></script>');
  writeFileSync(join(root,'privacy.html'),'<script>window.other=1;</script>');
  const run=()=>spawnSync(process.execPath,['scripts/security-headers.mjs'],{encoding:'utf8',env:{...process.env,SECURITY_BUILD_ROOT:root}});
  const r=run();assert.equal(r.status,0,r.stderr);
  const before=readFileSync(join(root,'_headers'),'utf8');
  assert.ok(before.includes("'sha256-"+createHash('sha256').update(script).digest('base64')+"'"));
  assert.ok(before.includes("script-src-attr 'none'"));assert.ok(!before.includes("script-src 'self' 'unsafe-inline'"));
  assert.ok(before.split('\n').every(line=>line.length<=2000));
  assert.equal(run().status,0);assert.equal(readFileSync(join(root,'_headers'),'utf8'),before);
 }finally{rmSync(root,{recursive:true,force:true});}
});
