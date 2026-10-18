/** API routes fail closed on quota exhaustion; static routes remain excluded from Functions. */
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!/^[a-f0-9]{32}$/.test(account??'')||!token)throw Error('Cloudflare deployment credentials are required');
const url=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/puntersedge`;
const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
const response=await fetch(url,{method:'PATCH',headers,body:JSON.stringify({deployment_configs:{production:{fail_open:false},preview:{fail_open:false}}}),signal:AbortSignal.timeout(20000)});
const result=await response.json();
if(!response.ok||!result.success||result.result?.deployment_configs?.production?.fail_open!==false||result.result?.deployment_configs?.preview?.fail_open!==false)throw Error('Cloudflare API fail-closed configuration could not be verified');
console.log('API fail-closed configuration verified for production and preview.');
