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

// Static HTML alone cannot establish that deployed Functions are running.
for(const path of ['/api/preview','/api/tennis']){
 let verified=false,detail='';
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetch(new URL(path,base),{signal:AbortSignal.timeout(20000)});
  const type=response.headers.get('Content-Type')??'';detail=`${response.status} ${type}`;
  if(path==='/api/tennis')verified=response.status===403&&!type.includes('text/html')&&response.headers.get('X-PuntersEdge-API')==='1';
  else if(response.ok&&type.includes('application/gzip')&&response.headers.get('X-PuntersEdge-API')==='1'){
   const bytes=new Uint8Array(await response.arrayBuffer());const {gunzipSync}=await import('node:zlib');
   const data=JSON.parse(bytes[0]===31?gunzipSync(bytes,{maxOutputLength:65536}).toString():new TextDecoder().decode(bytes));
   verified=data.access==='preview'&&data.v===1&&Array.isArray(data.previewFixtures);
  }
  if(verified)break;
  if(attempt<2)await new Promise(resolve=>setTimeout(resolve,3000));
 }
 assert.ok(verified,`Production API unavailable ${path}: ${detail}`);
 console.log(JSON.stringify({path,runtimeApi:true}));
}
