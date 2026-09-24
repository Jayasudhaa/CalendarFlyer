const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const target = path.join(root, 'Test');
const skipDirs = new Set(['node_modules', '.git', 'dist', 'dist-frontend']);
const manifest = [];
function copy(source, destination, project) {
  fs.mkdirSync(destination, {recursive:true});
  for(const item of fs.readdirSync(source,{withFileTypes:true})) {
    if(item.isSymbolicLink() || item.name.startsWith('.env') || /\.bak\d*$|\.(zip|gz|log)$|-config\.json$|-policy\.json$/.test(item.name)) continue;
    const from=path.join(source,item.name), to=path.join(destination,item.name);
    if(item.isDirectory()) {
      if(!skipDirs.has(item.name) && from !== path.join(root,'server','data')) copy(from,to,project);
      continue;
    }
    const data=fs.readFileSync(from);
    manifest.push({path:path.relative(root,from),sha256:crypto.createHash('sha256').update(data).digest('hex')});
    let content=data;
    if(project==='server' && item.name.endsWith('.js')) {
      content=data.toString('utf8')
        .replace(/new DynamoDBClient\(\{/g,'new DynamoDBClient({ endpoint: process.env.AWS_ENDPOINT_URL_DYNAMODB,')
        .replace(/new AWS\.DynamoDB\.DocumentClient\(\{/g,'new AWS.DynamoDB.DocumentClient({ endpoint: process.env.AWS_ENDPOINT_URL_DYNAMODB,');
    }
    fs.writeFileSync(to,content);
  }
}
for(const project of ['server','temple-calendar']) copy(path.join(root,project),path.join(target,project),project);
const serverPath=path.join(target,'server/server.js');
let server=fs.readFileSync(serverPath,'utf8');
if(!server.includes("require('./scheduler').start();")) throw new Error('Review scheduler setup before refreshing');
server="require('./test-environment.cjs').validate(process.env);\n"+server
  .replace('const app = express();',"const app = express();\napp.get('/api/test-environment', (req,res) => res.json({environment:'local',isolated:true}));")
  .replace("require('./scheduler').start();","console.log('[TEST] Broadcast scheduler disabled.');");
fs.writeFileSync(serverPath,server);
const entry=path.join(target,'temple-calendar/src/main.jsx');
fs.writeFileSync(entry,fs.readFileSync(entry,'utf8').replace(/clientId="[^"]+"/,'clientId="local-test-disabled"'));
const index=path.join(target,'temple-calendar/index.html');
fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace('<body>','<body><div style="background:#8b1538;color:white;padding:8px;text-align:center;font-family:sans-serif">LOCAL TEST SYSTEM - test data only; external services disabled</div>'));
fs.writeFileSync(path.join(target,'reports/current-source-manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),files:manifest},null,2));
console.log(`Refreshed ${manifest.length} files; local isolation retained.`);
