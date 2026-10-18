import test from 'node:test';
import assert from 'node:assert/strict';
import {enrichFixtureMetadata,fixtureMetadataLines} from '../src/lib/fixture-metadata.js';
import {shareSlipText} from '../src/lib/slips.js';
import {publicPreviewDocument} from '../scripts/publish-public-preview.mjs';
test('legacy tickets fill missing metadata from their fixture without overwriting recorded names',()=>{
 const item={sport:'football',league:'Recorded Cup',country:'',tournament:'Finals'};
 const data=enrichFixtureMetadata(item,{league:'Other league',country:'Nigeria'});
 assert.equal(data.league,'Recorded Cup');assert.equal(data.country,'Nigeria');
 assert.deepEqual(fixtureMetadataLines(data),['Sport: Football','League: Recorded Cup','Tournament: Finals','Country: Nigeria']);
 assert.equal(item.country,'');
});
test('missing countries are omitted rather than inferred from a player, team or league name',()=>{
 assert.deepEqual(fixtureMetadataLines({sport:'tennis',league:'ATP',tournament:'Tokyo'}),['Sport: Tennis','League: ATP','Tournament: Tokyo']);
 assert.equal(enrichFixtureMetadata({league:'League unavailable'},{league:'Premier League'}).league,'Premier League');
});
test('WhatsApp and clipboard content retain sport, separate competition names and known country',()=>{
 const text=shareSlipText({name:'Weekend',betType:'acca',stake:100,potentialReturn:0,items:[{sport:'tennis',league:'WTA',tournament:'Japan Open',country:'Japan',matchTitle:'A vs B',market:'Match winner',selection:'A',bookmaker:'Unpriced',odds:0}]});
 for(const expected of ['Sport: Tennis','League: WTA','Tournament: Japan Open','Country: Japan','https://puntersedge.ewinproject.org/betslips'])assert.ok(text.includes(expected));
});
test('public R2 preview reconstructs a strict whitelist and cannot publish private model data',()=>{
 const full={v:1,access:'preview',generatedAt:new Date().toISOString(),previewFixtures:[{id:'1',sport:'football',league:'Cup',home:'A',away:'B',kickoff:new Date().toISOString(),privateModel:{secret:1},headline:{selection:'A',modelProb:.6,odds:2,privateUrl:'secret'}}],inputs:{football:[{private:true}]},privateUrl:'secret',usage:{private:true}};
 const result=publicPreviewDocument(full);assert.equal(result.previewFixtures.length,1);
 assert.ok(!JSON.stringify(result).includes('secret'));assert.deepEqual(result.inputs.football,[]);assert.equal(result.usage,null);
 assert.throws(()=>publicPreviewDocument({...full,access:'premium'}),/limited public preview/);
});
