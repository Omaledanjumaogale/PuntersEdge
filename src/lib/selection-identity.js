/** Never infer a home side from the favourite or from display ordering. @param {string} text @param {string} home @param {string} away */
export function identityParts(text,home='',away=''){
 const names=[{name:home,side:'home'},{name:away,side:'away'}].filter(n=>n.name&&home!==away).sort((a,b)=>b.name.length-a.name.length);
 /** @type {{text:string;side:string}[]} */const parts=[];let position=0;
 while(position<text.length){let found=null;for(const n of names){let at=text.toLowerCase().indexOf(n.name.toLowerCase(),position);while(at>=0&&(/[\p{L}\p{N}]/u.test(text[at-1]??'')||/[\p{L}\p{N}]/u.test(text[at+n.name.length]??'')))at=text.toLowerCase().indexOf(n.name.toLowerCase(),at+1);if(at>=0&&(!found||at<found.at))found={...n,at};}if(!found){parts.push({text:text.slice(position),side:''});break;}if(found.at>position)parts.push({text:text.slice(position,found.at),side:''});parts.push({text:text.slice(found.at,found.at+found.name.length),side:found.side});position=found.at+found.name.length;}
 return parts;
}
/** Team totals may carry the side only in the stable market identifier. @param {{id?:string;market?:string;selection:string}} selection @param {string} home @param {string} away */
export function selectionSide(selection,home='',away=''){
 const sides=new Set(identityParts(selection.selection,home,away).map(p=>p.side).filter(Boolean));if(sides.size===1)return [...sides][0];if(sides.size>1)return '';
 const key=selection.id??'';const structured=key.match(/:(?:forecast|period):[^:]+:(home|away):/);if(structured)return structured[1];
 const marketSides=new Set(identityParts(selection.market??'',home,away).map(p=>p.side).filter(Boolean));return marketSides.size===1?[...marketSides][0]:'';
}
