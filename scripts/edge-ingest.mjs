import {ConvexHttpClient} from 'convex/browser';
import {makeFunctionReference} from 'convex/server';
import {executeIngest} from '../src/lib/feeds/ingest-runtime.js';
import {blobClient} from '../src/lib/feeds/blob-client.js';
const client=new ConvexHttpClient(process.env.PUBLIC_CONVEX_URL);client.setAdminAuth(process.env.CONVEX_DEPLOY_KEY);
const rpc=Object.fromEntries(['query','mutation','action'].map(kind=>[kind,(name,args)=>client[kind](makeFunctionReference(name),args)]));
const result=await executeIngest({rpc,blobs:blobClient(process.env.EDGE_DATA_URL,process.env.EDGE_DATA_SECRET),keys:{apiSports:process.env.API_SPORTS_KEY||process.env.API_FOOTBALL_KEY||'',oddsApi:process.env.THE_ODDS_API_KEY||'',oddspapi:process.env.ODDSPAPI_KEY||''}});
console.log(JSON.stringify(result));
