/** Private R2 binding. No public bucket URL or user-supplied remote fetches. */
export interface DataBucket {
 get(key:string):Promise<{body:ReadableStream;size:number;etag:string;arrayBuffer():Promise<ArrayBuffer>}|null>;
 put(key:string,value:ArrayBuffer|ReadableStream,options?:unknown):Promise<unknown>;
 delete(key:string):Promise<void>;
}
export const dataBucket=(platform:App.Platform|undefined)=>platform?.env?.DATA_BUCKET as DataBucket|undefined;
export function validBlobKey(key:string){return /^(state|feed|preview|archives|outbox|backup)\/[A-Za-z0-9_./-]{1,220}$/.test(key)&&!key.includes('..');}
export function sameSecret(a:string,b:string){if(!a||!b||a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
