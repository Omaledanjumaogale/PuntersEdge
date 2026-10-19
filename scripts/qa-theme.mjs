import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const module=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const {chromium}=module.default??module;
const base=process.env.QA_BASE_URL??'https://puntersedge.ewinproject.org';
const browser=await chromium.launch({headless:true});
try {
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900},colorScheme:'dark',reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  const light=page.getByRole('button',{name:'Switch to light mode',exact:true});await light.waitFor({timeout:60000});
  const dark=await page.evaluate(()=>({ink:getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim(),meta:document.querySelector('meta[name="theme-color"]')?.content,overflow:document.documentElement.scrollWidth>innerWidth+1}));
  assert.equal(dark.ink,'#050505');assert.equal(dark.meta,'#050505');assert.equal(dark.overflow,false);
  const feedback=await light.evaluate(e=>({shadow:getComputedStyle(e).boxShadow,duration:getComputedStyle(e).transitionDuration}));
  assert.notEqual(feedback.shadow,'none');assert.ok(feedback.duration.split(',').every(t=>parseFloat(t)<=.001));
  await light.click();await page.getByRole('button',{name:'Switch to dark mode',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim()),'#f4f5ff');
  await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();await light.waitFor();
  assert.deepEqual(errors,[]);console.log(JSON.stringify({width,darkBlack:true,lightPreserved:true,reducedMotion:true,buttonHighlights:true,overflow:false,errors}));
  await page.close();
 }
}finally{await browser.close();}
