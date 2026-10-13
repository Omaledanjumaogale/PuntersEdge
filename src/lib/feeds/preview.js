import { predict } from './build.js';
/** Public board previews never include engine inputs, full market lists or premium file URLs. */
export function buildBoardPreview(/** @type {any} */ feed, /** @type {number} */ now) {
 const published=new Set((feed.projections??[]).filter((/** @type {any} */ p)=>p.state==='scheduled').map((/** @type {any} */ p)=>p.fixtureId));
 const eligible=(feed.games??[]).filter((/** @type {any} */ g)=>g.status.state==='scheduled'&&Date.parse(g.kickoff)>now&&published.has(g.id)).sort((/** @type {any} */ a,/** @type {any} */ b)=>a.kickoff.localeCompare(b.kickoff));
 const selected=[],sports=new Set();
 for(const game of eligible)if(!sports.has(game.sport)){selected.push(game);sports.add(game.sport);if(selected.length===5)break;}
 for(const game of eligible)if(selected.length<5&&!selected.some(g=>g.id===game.id))selected.push(game);
 const previews=selected.map(game=>{
  let headline=null;
  const input=feed.inputs?.[game.sport]?.find((/** @type {any} */ i)=>i.fixtureId===game.id);
  if(input)try{const p=predict(game.sport,input,{now});const pick=p.markets.flatMap((/** @type {any} */ g)=>g.selections).filter((/** @type {any} */ s)=>s.pricing==='quoted'&&s.bestOdds>1&&Number.isFinite(s.modelProb)).sort((/** @type {any} */ a,/** @type {any} */ b)=>b.modelProb-a.modelProb)[0];if(pick)headline={selection:pick.selection,odds:pick.bestOdds,modelProb:pick.modelProb};}catch{}
  return {id:game.id,sport:game.sport,league:game.league,home:game.home,away:game.away,kickoff:game.kickoff,headline};
 });
 return {v:1,access:'preview',generatedAt:feed.generatedAt,previewFixtures:previews,inputs:{football:[],basketball:[],nba:[],hockey:[],baseball:[]},games:[],record:{summary:{all:{picks:0,won:0,lost:0,push:0,profit:0,roi:0},grades:{},sports:{}},recent:[],pending:0},projections:[],reviewInputs:{},usage:null,sources:{}};
}
