/** Never navigate to a host supplied by an unexpected provider response. */
export function checkoutUrl(value: unknown, provider: 'flutterwave'|'korapay') {
 if(typeof value!=='string')throw new Error('Payment provider did not return a checkout URL.');
 const url=new URL(value);
 const hosts=provider==='korapay'?['checkout.korapay.com']:['checkout.flutterwave.com'];
 if(url.protocol!=='https:'||url.username||url.password||url.port||!hosts.includes(url.hostname))throw new Error('Payment provider returned an unexpected checkout address.');
 return url.href;
}
export function validateKoraCharge(data:Record<string,unknown>, expected:{reference:string;amount:number;currency:string;customerEmail?:string}) {
 const customer=data.customer as {email?:string}|undefined;
 if(data.status!=='success'||data.reference!==expected.reference||Number(data.amount)!==expected.amount||data.currency!==expected.currency||
  (customer?.email&&expected.customerEmail&&customer.email.toLowerCase()!==expected.customerEmail.toLowerCase()))throw new Error('Verified charge does not match your subscription.');
}
export async function signHmac(message:string,key:string,format:'hex'|'base64') {
 const enc=new TextEncoder();const k=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(message)));
 return format==='hex'?Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''):btoa(String.fromCharCode(...bytes));
}
export function equalSignature(a:string,b:string){if(a.length!==b.length)return false;let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0;}
