import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const module=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);const {chromium}=module.default??module;
const browser=await chromium.launch({headless:true});
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:1000},colorScheme:'dark'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const path of ['/','/privacy','/account/security','/account/privacy','/admin/payments','/admin/privacy']){
  const response=await page.goto('https://puntersedge.ewinproject.org'+path,{waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(response.status(),200,path);
  const policy=response.headers()['content-security-policy']??'';assert.ok(policy.includes("script-src 'self'"),path+' missing script policy');assert.ok(!policy.includes("script-src 'self' 'unsafe-inline'"));
  await page.waitForFunction(()=>document.documentElement.dataset.motion,null,{timeout:45000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,path+' overflow');
  if(path==='/'){
   await page.evaluate(()=>{const el=document.createElement('script');el.textContent='window.__unapprovedCspProbe=1';document.body.append(el);});
   assert.equal(await page.evaluate(()=>window.__unapprovedCspProbe),undefined,'unhashed inline script executed');
   await page.screenshot({path:`../audit-production-${width}.png`,fullPage:true});
  }
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({width,staticRoutes:6,hydration:true,inlineProbeBlocked:true,overflow:false,pageErrors:errors}));await page.close();
}}finally{await browser.close();}
