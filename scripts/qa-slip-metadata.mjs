import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const module=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');const {chromium}=module.default??module;
const base=process.env.QA_BASE_URL??'http://127.0.0.1:5176';if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Synthetic ticket QA is restricted to localhost');
const browser=await chromium.launch({headless:true});
try{for(const width of [320,390,1440]){
 const page=await browser.newPage({viewport:{width,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth/**',r=>r.fulfill({status:200,contentType:'application/json',body:'null'}));await page.route('**/api/preview',r=>r.fulfill({status:503,body:'Unavailable'}));
 console.log('Starting width '+width);await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>document.documentElement.dataset.motion,null,{timeout:120000});
 console.log('Hydrated '+width);await page.evaluate(async()=>{
  const {feed}=await import('/src/lib/feed.svelte.ts');feed.stop();const kickoff=new Date(Date.now()+86400000).toISOString();
  feed.data={v:1,generatedAt:new Date().toISOString(),inputs:{football:[],basketball:[],nba:[],hockey:[],baseball:[]},games:[{id:'metadata-qa',sport:'football',league:'Premier League',tournament:'League season',country:'England',home:'Home',away:'Away',kickoff,status:{state:'scheduled'},priced:true,books:1}],projections:[{fixtureId:'metadata-qa'}],record:{summary:{},recent:[],pending:0},sources:{},usage:null};feed.mode='live';
  const {app}=await import('/src/lib/state.svelte.ts');app.slip=[{id:'metadata-qa:home',fixtureId:'metadata-qa',sport:'football',marketKey:'home',matchTitle:'Home vs Away',market:'Match winner',selection:'Home',bookmaker:'Book',odds:2,modelProb:.6,edgePercent:0},{id:'tennis-qa:match_winner:a',fixtureId:'tennis-qa',sport:'tennis',league:'WTA',tournament:'Japan Open',country:'Japan',matchTitle:'First Player vs Second Player',market:'Match winner',selection:'First Player',bookmaker:'Unpriced',odds:0,modelProb:.65,edgePercent:0}];app.slipOpen=true;
  Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>window.__shared=payload});
 });
 console.log('Ticket injected '+width);const dialog=page.getByRole('dialog',{name:'Betslip',exact:false});await dialog.waitFor();
 for(const value of ['Sport: Football','League: Premier League','Tournament: League season','Country: England','Sport: Tennis','Tournament: Japan Open','Country: Japan'])assert.ok((await dialog.innerText()).includes(value),value);
 await dialog.getByRole('button',{name:'Preview full ticket & set stake'}).click();
 await page.getByRole('button',{name:'Share ticket · WhatsApp & more'}).click();
 const shared=await page.evaluate(()=>window.__shared.text);
 for(const value of ['Sport: Football','League: Premier League','Tournament: League season','Country: England','Sport: Tennis','Tournament: Japan Open','Country: Japan'])assert.ok(shared.includes(value),'Shared '+value);
 if(width===390){const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();await(await download).saveAs('../PuntersEdge-Metadata-verification.pdf');await page.screenshot({path:'../metadata-betslip-mobile.png',fullPage:true});}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({width,legacyMetadataResolved:true,ticketMetadata:true,shareMetadata:true,pdf:width===390,overflow:false,errors}));await page.close();
}}finally{await browser.close();}
