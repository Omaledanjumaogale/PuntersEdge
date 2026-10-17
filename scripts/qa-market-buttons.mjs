/** Local synthetic UI regression. No login, provider call or server-side ticket write. */
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {FOOTBALL_INPUTS} from '../src/lib/data/fixtures.js';
const playwright=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const {chromium}=playwright.default??playwright;
const base=process.env.QA_BASE_URL??'http://127.0.0.1:5174';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Synthetic QA is restricted to a local server');
const now=Date.now(),kickoff=new Date(now+86400000).toISOString();
const input={...structuredClone(FOOTBALL_INPUTS[0]),fixtureId:'local-market-qa',kickoffTime:kickoff,status:{state:'scheduled'}};
const data={v:1,access:'preview',generatedAt:new Date().toISOString(),previewFixtures:[],
 inputs:{football:[input],basketball:[],nba:[],hockey:[],baseball:[]},
 games:[{id:input.fixtureId,sport:'football',league:input.league,home:input.homeTeam,away:input.awayTeam,kickoff,status:{state:'scheduled'},books:3,priced:true}],
 projections:[{fixtureId:input.fixtureId}],reviewInputs:{},usage:null,sources:{},record:{summary:{},recent:[],pending:0}};
const browser=await chromium.launch({headless:true});
try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/auth/**',route=>route.fulfill({status:200,contentType:'application/json',body:'null'}));
  await page.route('**/api/preview',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)}));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>document.documentElement.dataset.motion,null,{timeout:120000});
  await page.evaluate(async data=>{
   const {feed}=await import('/src/lib/feed.svelte.ts');feed.stop();feed.data=data;feed.mode='live';feed.status='ready';
   const {predict}=await import('/src/lib/feeds/build.js');const p=predict('football',data.inputs.football[0],{now:Date.now()});
   const {mount}=await import('/node_modules/.vite/deps/svelte.js');
   const target=document.createElement('div');target.id='market-qa';target.style.padding='12px';document.body.append(target);
   for(const child of [...document.body.children])if(child!==target&&child.tagName!=='SCRIPT')child.style.display='none';
   mount((await import('/src/lib/components/MarketList.svelte')).default,{target,props:{groups:p.markets}});
  },data);
  const target=page.locator('#market-qa');
  assert.equal(await target.locator('details[open]').count(),0,'Accordions must start collapsed');
  const group=target.locator('.market-accordion').filter({has:page.locator('.choice-add:not(:disabled)')}).first();
  await group.locator('.market-summary').click();
  const add=group.locator('button.choice-add:not(:disabled)').first();
  const box=await add.boundingBox();assert.ok(box.width>=44&&box.height>=44,'Touch target is at least 44px');
  assert.match(await add.getAttribute('aria-label'),/^Add .* to betslip$/);
  await add.click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('qe:slip:v2')??'[]').length===1);
  assert.equal(await add.getAttribute('aria-pressed'),'true');
  await add.click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('qe:slip:v2')??'[]').length===0);
  assert.equal(await add.getAttribute('aria-pressed'),'false');
  const unavailable=target.locator('button.choice-add:disabled').first();assert.ok(await unavailable.count(),'Unquoted choices have explicit disabled controls');
  assert.match(await unavailable.getAttribute('aria-label'),/bookmaker price unavailable/);
  const probs=await group.locator('.choice-prob').evaluateAll(nodes=>nodes.map(n=>parseFloat(n.textContent)));
  assert.ok(probs.every((p,i)=>!i||p<=probs[i-1]),'Options remain sorted by model probability');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,addRemovePersisted:true,unquotedDisabled:true,collapsedByDefault:true,touchTarget:box.width,errors}));
  await page.close();
 }
}finally{await browser.close();}
