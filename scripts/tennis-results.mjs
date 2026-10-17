/** Private R2 cache: no raw tennis corpus or fitted player table passes through Convex. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {blobClient} from '../src/lib/feeds/blob-client.js';
const root='training/private/valuebetennis',prefix='archives/tennis/results/';
const blobs=blobClient(process.env.EDGE_DATA_URL,process.env.EDGE_DATA_SECRET);
const fingerprint=bytes=>createHash('sha256').update(bytes).digest('hex');
const allowed=name=>{const match=/^valuebetennis-matchs-(20\d{2})\.csv$/.exec(name);return match?Number(match[1])>=2021&&Number(match[1])<=new Date().getUTCFullYear():['source-license.html','CC-BY-4.0.html'].includes(name);};
try{
 mkdirSync(root,{recursive:true});
 const previous=await blobs.get(prefix+'manifest.json.gz');
 const old=previous?JSON.parse(gunzipSync(previous,{maxOutputLength:65536})):null;
 if(process.argv[2]==='restore'){
  for(const file of old?.files??[]){
   if(!allowed(file.name)||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Invalid source manifest');
   const zipped=await blobs.get(prefix+'sources/'+file.sha256+'.gz');if(!zipped)throw Error('Missing archived source');
   const bytes=gunzipSync(zipped,{maxOutputLength:25*1024*1024});if(fingerprint(bytes)!==file.sha256)throw Error('Source fingerprint mismatch');
   writeFileSync(root+'/'+file.name,bytes);
  }
  console.log(JSON.stringify({restored:old?.files?.length??0}));
 }else if(process.argv[2]==='store'){
  const manifest=JSON.parse(readFileSync(root+'/manifest.json','utf8'));
  let written=0;for(const file of manifest.files){
   if(!allowed(file.name))throw Error('Invalid source filename');
   const bytes=readFileSync(root+'/'+file.name);if(fingerprint(bytes)!==file.sha256)throw Error('Local source fingerprint mismatch');
   if(!(old?.files??[]).some(prior=>prior.sha256===file.sha256)){await blobs.put(prefix+'sources/'+file.sha256+'.gz',gzipSync(bytes));written++;}
  }
  await blobs.put(prefix+'manifest.json.gz',gzipSync(JSON.stringify(manifest)));
  const artifact=gzipSync(readFileSync(root+'/fitted-ratings.json'));if(artifact.length>15*1024*1024)throw Error('Fitted artifact exceeds storage bound');
  await blobs.put(prefix+'fitted-ratings-latest.json.gz',artifact);
  await blobs.put(prefix+'report-latest.json.gz',gzipSync(readFileSync('training/reports/tennis-results-research.json')));
  console.log(JSON.stringify({sourceFiles:manifest.files.length,newSourceObjects:written,artifactBytes:artifact.length,liveEnabled:false}));
 }else throw Error('Use restore or store');
}catch{console.error('Results-only tennis archive failed; no live markets activated.');process.exitCode=1;}
