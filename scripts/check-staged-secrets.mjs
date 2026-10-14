import {execFileSync} from 'node:child_process';
const names=execFileSync('git',['diff','--cached','--name-only','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const secrets=Object.entries(process.env).filter(([name,value])=>/KEY|TOKEN|SECRET/.test(name)&&value&&value.length>=16).map(([,value])=>value);
let bad=false;for(const name of names){let content;try{content=execFileSync('git',['show',`:${name}`],{encoding:'utf8',maxBuffer:64*1024*1024});}catch{continue;}if(secrets.some(value=>content.includes(value))||/prod:[a-z0-9-]+\|eyJ/.test(content)){console.error(`Credential found in staged file: ${name}`);bad=true;}}
console.log(JSON.stringify({filesChecked:names.length,credentialsDetected:bad}));if(bad)process.exitCode=1;
