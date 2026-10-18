const sportNames={football:'Football',basketball:'Basketball',nba:'NBA basketball',hockey:'Ice hockey',baseball:'Baseball',tennis:'Tennis'};
/** @param {unknown} value */
function text(value){const result=typeof value==='string'?value.trim():'';return /^(?:unknown|n\/a|(?:league|country|tournament) unavailable)$/i.test(result)?'':result;}
/** Keep recorded metadata; fill gaps only from the same verified fixture. @param {any} item @param {any} [fixture] */
export function enrichFixtureMetadata(item,fixture={}){
 const result={...item};
 for(const key of ['sport','league','tournament','country']){const value=text(item[key])||text(fixture?.[key]);if(value)result[key]=value;else delete result[key];}
 if(!result.kickoff&&fixture?.kickoff)result.kickoff=fixture.kickoff;
 return result;
}
/** Shared human-readable metadata for screen, PDF and clipboard/WhatsApp. @param {any} item */
export function fixtureMetadataLines(item){
 const data=enrichFixtureMetadata(item),lines=[`Sport: ${sportNames[/** @type {keyof typeof sportNames} */(data.sport)]??(text(data.sport)||'Not recorded')}`];
 if(data.league&&data.tournament&&data.league!==data.tournament)lines.push(`League: ${data.league}`,`Tournament: ${data.tournament}`);
 else lines.push(`League / tournament: ${data.tournament||data.league||'Not recorded'}`);
 if(data.country)lines.push(`Country: ${data.country}`);
 return lines;
}
