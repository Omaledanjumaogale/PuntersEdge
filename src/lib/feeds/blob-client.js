/** Server-only bridge used by the scheduled worker and privileged Convex actions. */
/** @param {string|undefined} base @param {string|undefined} secret */
export function blobClient(base,secret){
 if(!base||!secret)throw new Error('Private data bridge is not configured');
 const origin=new URL(base);if(origin.protocol!=='https:'&&origin.hostname!=='localhost')throw new Error('HTTPS data bridge required');
 const request=async(/** @type {string} */key,method='GET',/** @type {Uint8Array|undefined} */body=undefined)=>{
  if(!/^(state|feed|preview|archives|outbox|backup)\/[A-Za-z0-9_./-]{1,220}$/.test(key)||key.includes('..'))throw new Error('Invalid data key');
  const response=await fetch(new URL(`/api/internal/blob/${key}`,origin),{method,headers:{Authorization:`Bearer ${secret}`,...(body?{'Content-Type':'application/gzip'}:{})},body:body?new Uint8Array(body).buffer:undefined,signal:AbortSignal.timeout(60000)});
  if(response.status===404&&method==='GET')return null;
  if(!response.ok)throw new Error(`Private data ${method} failed (${response.status})`);
  return method==='GET'?new Uint8Array(await response.arrayBuffer()):null;
 };
 return {get:(/** @type {string} */key)=>request(key),put:async(/** @type {string} */key,/** @type {Uint8Array} */body)=>{await request(key,'PUT',body);return key;},delete:(/** @type {string} */key)=>request(key,'DELETE')};
}
