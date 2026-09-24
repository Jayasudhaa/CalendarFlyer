const crypto = require('node:crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const prefix = 'calendarfly_staging_';
module.exports = function install(app) {
  if (process.env.APP_ENV !== 'staging' || process.env.STAGING_TABLE_PREFIX !== prefix) throw new Error('Staging identity is required');
  if (!process.env.S3_BUCKET_NAME?.startsWith('calendarfly-staging-')) throw new Error('Staging bucket required');
  for (const key of Object.keys(process.env)) {
    if (/(_TABLE$|API_KEY$|STRIPE_SECRET_KEY|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|GOOGLE_CLIENT_SECRET|FACEBOOK_APP_SECRET|INSTAGRAM_APP_SECRET|LAMBDA_)/.test(key) && process.env[key]) throw new Error('Staging forbids external credential/resource override: ' + key);
  }
  const secret = process.env.STAGING_ACCESS_KEY;
  if (!secret || secret.length < 32) throw new Error('A strong staging access key is required');
  const same = (a,b) => { const x=Buffer.from(a || ''),y=Buffer.from(b || ''); return x.length===y.length && crypto.timingSafeEqual(x,y); };
  const signature = value => crypto.createHmac('sha256',secret).update(value).digest('hex');
  const authorized = req => {
    if (same(req.headers['x-staging-key'],secret)) return true;
    const cookie = (req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith('cf_staging='))?.slice(11) || '';
    const [expires,mac] = cookie.split('.');
    return Number(expires)>Date.now() && same(mac,signature(expires));
  };
  app.use((req,res,next)=> { res.set('X-Robots-Tag','noindex, nofollow'); res.set('Cache-Control','no-store'); next(); });
  app.get('/api/health',(req,res)=>res.json({status:'ok',environment:'staging'}));
  app.get('/robots.txt',(req,res)=>res.type('text').send('User-agent: *\nDisallow: /\n'));
  app.post('/staging-login',rateLimit({windowMs:15*60*1000,limit:10}),express.urlencoded({extended:false}),(req,res)=>{
    if (req.body.username !== 'staging' || !same(req.body.password,secret)) return res.status(401).send('Incorrect staging credentials.');
    const expires=String(Date.now()+12*60*60*1000);
    res.cookie('cf_staging',expires+'.'+signature(expires),{httpOnly:true,secure:process.env.STAGING_LOCAL_VALIDATION !== '1',sameSite:'lax',maxAge:12*60*60*1000});
    res.redirect('/');
  });
  app.use((req,res,next)=>{
    if (authorized(req)) return next();
    if (req.path.startsWith('/api/') || !req.accepts('html')) return res.status(401).json({error:'Staging access required'});
    res.status(401).type('html').send('<!doctype html><html><head><meta name="robots" content="noindex"><title>CalendarFly staging</title></head><body style="font:18px sans-serif;max-width:440px;margin:80px auto"><h1>CalendarFly staging</h1><p>Private test environment. Use fictional data.</p><form method="post" action="/staging-login"><p><label>Username <input name="username" value="staging" autocomplete="username" required></label></p><p><label>Password <input name="password" type="password" autocomplete="current-password" required></label></p><button>Open staging</button></form></body></html>');
  });
  app.get('/api/staging-status',(req,res)=>res.json({environment:'staging',tablePrefix:prefix,integrations:'disabled',scheduler:'disabled'}));
  const blocked = /^\/(?:auth(?:\/|$)|api\/(?:billing|broadcast|social|contact|chat|community\/(?:send-otp|verify-otp|request-code|verify-code)|identity\/(?:request-code|verify-code)|generate-image|generate-flyer|translate|remove-bg|image-feedback|documents)(?:\/|$)|api\/auth\/(?:signup|google|forgot-password|resend-verification)(?:\/|$))/;
  app.use((req,res,next)=> blocked.test(req.path) ? res.status(503).json({error:'This integration is disabled in staging.'}) : next());
  const s3 = new S3Client({region:process.env.AWS_REGION});
  // Private S3 media is served only to testers who passed the staging gate.
  app.get('/api/staging-media/*',async(req,res)=>{
    try { const obj=await s3.send(new GetObjectCommand({Bucket:process.env.S3_BUCKET_NAME,Key:req.params[0]})); res.type(obj.ContentType || 'application/octet-stream'); obj.Body.on('error',()=>res.destroy()); obj.Body.pipe(res); }
    catch { res.status(404).json({error:'Test media not found'}); }
  });
  const mediaOrigin=`https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
  const rewrite=value=>{
    if (typeof value==='string' && value.startsWith(mediaOrigin) && !value.includes('?')) return '/api/staging-media/'+value.slice(mediaOrigin.length);
    if (Array.isArray(value)) return value.map(rewrite);
    if (value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)]));
    return value;
  };
  app.use((req,res,next)=>{ const json=res.json.bind(res); res.json=value=>json(rewrite(value)); next(); });
};
