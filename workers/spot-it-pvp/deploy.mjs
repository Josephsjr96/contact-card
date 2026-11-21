import fs from 'node:fs/promises';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in the environment.');
async function api(path,options={}){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{...options,headers:{Authorization:'Bearer '+token,...options.headers}});const data=await r.json();if(!r.ok||!data.success)throw Error(JSON.stringify(data.errors));return data.result}
const scripts=await api('/workers/scripts'),exists=scripts.some(s=>s.id==='spot-it-pvp');
const metadata={main_module:'worker.mjs',compatibility_date:'2026-11-21',bindings:[{type:'durable_object_namespace',name:'ROOMS',class_name:'SpotRoom'}],observability:{enabled:true,head_sampling_rate:0.1,redact_query_string:true,logs:{enabled:true,invocation_logs:true,head_sampling_rate:0.1},traces:{enabled:true,head_sampling_rate:0.1}}};
if(!exists)metadata.migrations={new_tag:'v1',new_sqlite_classes:['SpotRoom']};
const form=new FormData();form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
for(const name of ['worker.mjs','rules.mjs'])form.append(name,new Blob([await fs.readFile(new URL(name,import.meta.url),'utf8')],{type:'application/javascript+module'}),name);
await api('/workers/scripts/spot-it-pvp',{method:'PUT',body:form});
await api('/workers/scripts/spot-it-pvp/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true,previews_enabled:false})});
console.log('Deployed spot-it-pvp.');
