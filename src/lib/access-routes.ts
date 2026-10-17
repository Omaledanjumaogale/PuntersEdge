/** Joining, recovery and account management stay available independently of analytical access. */
export const premiumRoots=['/sports','/football','/nba','/basketball','/hockey','/baseball','/tennis','/match','/results','/value-bets','/bet-machine','/betslips','/bookmakers','/glossary','/settings'];
export function premiumPath(path:string){try{path=decodeURIComponent(path);}catch{return true;}return premiumRoots.some(root=>path===root||path.startsWith(root+'/'));}
