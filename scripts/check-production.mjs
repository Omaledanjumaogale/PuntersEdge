import assert from 'node:assert/strict';
const base=process.env.PUBLIC_SITE_URL??'https://puntersedge.ewinproject.org';
for(const path of ['/','/board','/login','/tester','/match','/betslips','/tennis']){
 let ok=false,detail='';
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetch(new URL(path,base),{signal:AbortSignal.timeout(20000)});
  const body=await response.text();detail=`${response.status}: ${body.slice(0,60)}`;
  if(response.ok&&body.includes('PuntersEdge')&&body.includes('_app/immutable/')){ok=true;break;}
  if(attempt<2)await new Promise(resolve=>setTimeout(resolve,3000));
 }
 assert.ok(ok,`Production shell failed ${path}: ${detail}`);
 console.log(JSON.stringify({path,staticShell:true}));
}
