/** Scheduled runners use the R2 control API, which does not invoke an app Worker. */
import {blobClient} from '../src/lib/feeds/blob-client.js';

export function runnerBlobs(env=process.env,{fetcher=fetch}={}){
 const account=env.CLOUDFLARE_ACCOUNT_ID,token=env.CLOUDFLARE_API_TOKEN,bucket=env.R2_BUCKET??'puntersedge-data';
 if(!account&&!token)return blobClient(env.EDGE_DATA_URL,env.EDGE_DATA_SECRET);
 if(!/^[a-f0-9]{32}$/.test(account??'')||!token||!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))throw Error('Direct R2 credentials or bucket configuration is incomplete');
 const request=async(key,method='GET',body)=>{
  if(!/^(state|feed|preview|archives|outbox|backup)\/[A-Za-z0-9_./-]{1,220}$/.test(key)||key.includes('..'))throw Error('Invalid data key');
  if(body&&body.byteLength>16*1024*1024)throw Error('Direct R2 object exceeds the upload limit');
  const url=`https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucket}/objects/${key.split('/').map(encodeURIComponent).join('/')}`;
  const response=await fetcher(url,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/gzip'}:{})},body:body?new Uint8Array(body).buffer:undefined,redirect:'error',signal:AbortSignal.timeout(60000)});
  if(response.status===404&&method==='GET')return null;
  if(!response.ok)throw Error(`Direct R2 ${method} failed (${response.status}); object contents and credentials omitted`);
  if(method!=='GET')return null;
  if(Number(response.headers.get('Content-Length'))>16*1024*1024)throw Error('Direct R2 response exceeds the download limit');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length>16*1024*1024)throw Error('Direct R2 response exceeds the download limit');
  return bytes;
 };
 return {get:key=>request(key),put:async(key,body)=>{await request(key,'PUT',body);return key;},delete:key=>request(key,'DELETE')};
}
