import assert from 'node:assert/strict';
const playwright=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const {chromium}=playwright.default??playwright;
const base=process.env.QA_BASE_URL??'http://127.0.0.1:5176';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Synthetic QA is local only');
const at=Date.now();
const snapshot={v:1,at,mode:'experimental_information',model:'Synthetic QA',bettingApproved:false,withheld:{},coverageErrors:[],fixtures:[{id:'tennis-qa',tour:'ATP',league:'Synthetic QA event',playerA:'First Player',playerB:'Second Player',kickoff:at+86400000,publishedAt:at,surface:'Unverified',markets:[{key:'match_winner',title:'Match winner',options:[{side:'b',selection:'Second Player',modelProb:.3},{side:'a',selection:'First Player',modelProb:.7}]}]}]};
const browser=await chromium.launch({headless:true});
try{for(const width of [320,390,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth/**',r=>r.fulfill({status:200,contentType:'application/json',body:'null'}));
 await page.route('**/api/preview',r=>r.fulfill({status:503,body:'Unavailable'}));
 await page.route('**/api/tennis',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot)}));
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>document.documentElement.dataset.motion,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {auth}=await import('/src/lib/auth.svelte.ts');auth.status='signedIn';auth.viewer={id:'local-tennis-qa',name:'QA',activeSubscription:true,superAdmin:true,emailVerified:true,settings:null,joined:Date.now(),email:'qa@example.test'};
  const {mount}=await import('/node_modules/.vite/deps/svelte.js');const target=document.createElement('section');target.id='tennis-qa';target.style.padding='12px';
  document.body.append(target);for(const child of [...document.body.children])if(child!==target&&child.tagName!=='SCRIPT')child.style.display='none';
  mount((await import('/src/routes/tennis/+page.svelte')).default,{target});
 });
 const target=page.locator('#tennis-qa');await target.getByRole('heading',{name:'First Player vs Second Player'}).waitFor({timeout:120000});
 assert.equal(await target.locator('details[open]').count(),0);
 await target.locator('summary').filter({hasText:'Match winner'}).click();
 const add=target.getByRole('button',{name:/^(Add|Remove) First Player Match winner (to|from) betslip$/});const box=await add.boundingBox();assert.ok(box.width>=44&&box.height>=44);
 await add.click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('qe:slip:v2')??'[]').some(i=>i.sport==='tennis'&&i.odds===0));
 assert.equal(await add.getAttribute('aria-pressed'),'true');
 await add.click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('qe:slip:v2')??'[]').length===0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log(JSON.stringify({width,collapsed:true,addRemove:true,unpriced:true,overflow:false,errors}));
 if(width===390)await page.screenshot({path:'../tennis-workspace-mobile.png',fullPage:true});
 await page.close();
}}finally{await browser.close();}
