/** Emulate exhausted Functions: serve only built files, no Worker and no API. */
import {createServer} from 'node:http';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const imported=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const {chromium}=imported.default??imported;
const root=resolve('.svelte-kit/cloudflare');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer((request,response)=>{
 const path=decodeURIComponent(new URL(request.url,'http://localhost').pathname),file=resolve(root,'.'+path);
 if(file!==root&&!file.startsWith(root+sep)){response.writeHead(400).end();return;}
 const found=[file,file+'.html',resolve(file,'index.html')].find(p=>existsSync(p)&&statSync(p).isFile());
 if(path.startsWith('/api/')){response.writeHead(503,{'Content-Type':'text/plain'}).end('Functions unavailable');return;}
 const target=found??resolve(root,'404.html');response.writeHead(found?200:404,{'Content-Type':mime[extname(target)]??'application/octet-stream'});response.end(readFileSync(target));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const path of ['/','/board','/login','/tester']){
   const response=await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:60000});
   assert.equal(response.status(),200);
   await page.waitForFunction(()=>document.documentElement.dataset.motion,null,{timeout:30000});
   await page.waitForTimeout(500);
   let fits=false;for(let attempt=0;attempt<3;attempt++){try{fits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);break;}catch(error){if(attempt===2)throw error;await page.waitForTimeout(800);}}
   assert.ok(fits);
   assert.deepEqual(errors,[]);
   console.log(JSON.stringify({width,path,functionsAvailable:false,rendered:true,errors}));
  }
  await page.close();
 }
 const recovery=await fetch(base+'/unknown-page');assert.equal(recovery.status,404);assert.match(await recovery.text(),/Open board/);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
