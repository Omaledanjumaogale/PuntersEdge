import {readdirSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=process.env.SECURITY_BUILD_ROOT??'.svelte-kit/cloudflare';
const pages=[];
function visit(folder){
 for(const name of readdirSync(folder).sort()){
  const path=join(folder,name);
  if(statSync(path).isDirectory()){if(!name.startsWith('_app'))visit(path);continue;}
  if(!name.endsWith('.html'))continue;
  const hashes=new Set();
  for(const match of readFileSync(path,'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
   if(!/\bsrc\s*=/i.test(match[1])&&match[2].trim())hashes.add("'sha256-"+createHash('sha256').update(match[2]).digest('base64')+"'");
  const url='/'+relative(root,path).replaceAll('\\','/').replace(/(?:^|\/)index\.html$/,'').replace(/\.html$/,'');
  const policy="default-src 'self'; script-src 'self' "+[...hashes].join(' ')+"; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self'; connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud https://data.puntersedge.ewinproject.org; worker-src 'self' blob:; manifest-src 'self'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'; upgrade-insecure-requests; report-uri /api/security-report";
  const line='  Content-Security-Policy: '+policy;
  if(line.length>2000)throw Error('Page CSP exceeds Cloudflare header line limit: '+url);
  pages.push(url+'\n'+line);
 }
}
visit(root);if(!pages.length)throw Error('No HTML pages found; refusing an incomplete security policy.');
const path=join(root,'_headers'),marker='# === PAGE SCRIPT CSP ===';
const source=readFileSync(path,'utf8').split(marker)[0].replace(/Content-Security-Policy:.*$/m,"Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'").trimEnd();
if(source.split('\n').filter(line=>line.startsWith('/')).length+pages.length>100)throw Error('Cloudflare header rule limit exceeded.');
writeFileSync(path,source+'\n\n'+marker+'\n'+pages.join('\n\n')+'\n');
console.log('Page-specific hash CSP generated for '+pages.length+' static pages within Cloudflare limits. Dynamic styles remain explicitly allowed.');
