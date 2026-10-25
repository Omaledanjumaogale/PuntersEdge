/** Scheduled runners use the R2 control API, which does not invoke an app Worker. */
import {blobClient} from '../src/lib/feeds/blob-client.js';

export function runnerBlobs(env=process.env,{fetcher=fetch,cacheControl=undefined,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const account=env.CLOUDFLARE_ACCOUNT_ID,token=env.CLOUDFLARE_API_TOKEN,bucket=env.R2_BUCKET??'puntersedge-data';
 if(!account&&!token)return blobClient(env.EDGE_DATA_URL,env.EDGE_DATA_SECRET);
 if(!/^[a-f0-9]{32}$/.test(account??'')||!token||!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))throw Error('Direct R2 credentials or bucket configuration is incomplete');
 const request=async(key,method='GET',body)=>{
  if(!/^(state|feed|preview|archives|outbox|backup)\/[A-Za-z0-9_./-]{1,220}$/.test(key)||key.includes('..'))throw Error('Invalid data key');
  if(body&&body.byteLength>16*1024*1024)throw Error('Direct R2 object exceeds the upload limit');
  const url=`https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucket}/objects/${key.split('/').map(encodeURIComponent).join('/')}`;
  for(let attempt=0;attempt<3;attempt++){
  let response;try{response=await fetcher(url,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/gzip',...(cacheControl?{'Cache-Control':cacheControl}:{})}:{})},body:body?new Uint8Array(body).buffer:undefined,redirect:'error',signal:AbortSignal.timeout(60000)});}catch{
   if(attempt<2){await sleep(1000*3**attempt);continue;}throw Error(`Direct R2 ${method} network failure after 3 attempts; contents and credentials omitted`);
  }
  // All operations address the same object with the same bytes. Retrying a
  // lost response is safe; a repeated successful DELETE can return 404.
  if(response.status===404&&['GET','DELETE'].includes(method))return null;
  if((response.status===429||response.status>=500)&&attempt<2){await response.body?.cancel();const retryAfter=Number(response.headers.get('Retry-After'));await sleep(Number.isFinite(retryAfter)&&retryAfter>0?Math.min(30000,retryAfter*1000):1000*3**attempt);continue;}
  if(!response.ok)throw Error(`Direct R2 ${method} failed (${response.status}); object contents and credentials omitted`);
  if(method!=='GET')return null;
  if(Number(response.headers.get('Content-Length'))>16*1024*1024)throw Error('Direct R2 response exceeds the download limit');
  let bytes;try{bytes=new Uint8Array(await response.arrayBuffer());}catch{
   if(attempt<2){await sleep(1000*3**attempt);continue;}throw Error(`Direct R2 GET body interrupted after 3 attempts; contents and credentials omitted`);
  }
  if(bytes.length>16*1024*1024)throw Error('Direct R2 response exceeds the download limit');
  return bytes;
  }
 };
 return {get:key=>request(key),put:async(key,body)=>{await request(key,'PUT',body);return key;},delete:key=>request(key,'DELETE')};
}
