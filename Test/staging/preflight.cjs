const assert=require('node:assert/strict');
(async()=>{
 const base='http://localhost:5101';
 for(let n=0;;n++){try {await fetch(base+'/api/health');break;}catch(e){if(n>30)throw e;await new Promise(r=>setTimeout(r,1000));}}
 let r=await fetch(base+'/api/staging-status');assert.equal(r.status,401);
 r=await fetch(base+'/api/health');assert.equal((await r.json()).environment,'staging');
 r=await fetch(base+'/api/staging-status',{headers:{'x-staging-key':'local-preflight-only-access-key-1234567890'}});assert.equal(r.status,200);
 r=await fetch(base+'/api/billing',{headers:{'x-staging-key':'local-preflight-only-access-key-1234567890'}});assert.equal(r.status,503);
 r=await fetch(base+'/staging-login',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:'username=staging&password=local-preflight-only-access-key-1234567890'});assert.equal(r.status,302);
 const cookie=r.headers.get('set-cookie').split(';')[0];
 r=await fetch(base+'/api/staging-status',{headers:{cookie,authorization:'Bearer test'}});assert.equal(r.status,200);
 console.log('PASS gate, cookies, bearer compatibility, health marker, and integration blocking');
})().catch(e=>{console.error(e);process.exitCode=1});
