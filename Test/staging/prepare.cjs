const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const output = path.join(__dirname, 'build');
const prefix = 'calendarfly_staging_';
const omitDirs = new Set(['node_modules','dist','dist-frontend','.git']);
function excluded(name) { return name.startsWith('.env') || /\.bak\d*$|\.(zip|gz|log)$|-config\.json$|-policy\.json$/.test(name) || ['build-log.txt','check-key.js','test-claude.js','FIX-EVERYTHING.ps1','DEPLOYMENT.md'].includes(name); }
const manifest = [];
function copy(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || excluded(entry.name)) continue;
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isDirectory()) { if (!omitDirs.has(entry.name) && from !== path.join(root, 'server', 'data')) copy(from, to); }
    else { const data = fs.readFileSync(from); fs.writeFileSync(to, data); manifest.push({ path: path.relative(root, from), sha256: crypto.createHash('sha256').update(data).digest('hex') }); }
  }
}
// Clean only the generated build directory, never source or credentials.
if (path.dirname(output) !== __dirname || path.basename(output) !== 'build') throw new Error('Unsafe build path');
fs.rmSync(output, { recursive: true, force: true });
for (const project of ['server','temple-calendar']) copy(path.join(root, project), path.join(output, project));
const tableNames = new Set();
function transform(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { transform(file); continue; }
    if (!/\.(js|jsx|html)$/.test(entry.name)) continue;
    let code = fs.readFileSync(file, 'utf8');
    if (file.startsWith(path.join(output, 'server'))) {
      code = code.replace(/(['"])(calendarfly_[a-z_]+|temple_rsvp|temple-events|temple-panchang)\1/g, (_, q, name) => { tableNames.add(name); return q + prefix + name + q; });
    }
    // Share links stay on staging; no generated link takes testers to production.
    if (file.endsWith('.js') || file.endsWith('.jsx')) {
      const isFrontend = file.startsWith(path.join(output, 'temple-calendar') + path.sep);
      code = code.replace(/(['"])https:\/\/calendarflyapp\.com([^'"\r\n]*)\1/g, (_, q, suffix) => isFrontend ? `(window.location.origin + ${JSON.stringify(suffix)})` : `(process.env.FRONTEND_URL + ${JSON.stringify(suffix)})`);
      code = code.replace(/https:\/\/calendarflyapp\.com(?=[^'"\r\n]*`)/g, isFrontend ? '${window.location.origin}' : '${process.env.FRONTEND_URL}');
    }
    fs.writeFileSync(file, code);
  }
}
transform(output);
let server = fs.readFileSync(path.join(output,'server/server.js'),'utf8');
if (!server.includes("require('./scheduler').start();")) throw new Error('Review scheduler initialization before building staging');
server = server.replace('const app = express();', "const app = express();\nrequire('./staging-runtime.cjs')(app);");
server = server.replace("require('./scheduler').start();", "console.log('[STAGING] Background broadcasts disabled');");
fs.writeFileSync(path.join(output,'server/server.js'), server);
fs.copyFileSync(path.join(__dirname,'staging-runtime.cjs'),path.join(output,'server/staging-runtime.cjs'));
let entry = fs.readFileSync(path.join(output,'temple-calendar/src/main.jsx'),'utf8').replace(/clientId="[^"]+"/, 'clientId="staging-google-disabled"');
fs.writeFileSync(path.join(output,'temple-calendar/src/main.jsx'),entry);
const index = path.join(output,'temple-calendar/index.html');
fs.writeFileSync(index, fs.readFileSync(index,'utf8').replace('<head>','<head><meta name="robots" content="noindex,nofollow">').replace('<body>','<body><div style="background:#8b1538;color:white;padding:10px;text-align:center;font-family:sans-serif">STAGING — TEST DATA ONLY — payments, messaging, Google/social login and AI disabled</div>'));
fs.copyFileSync(path.join(__dirname,'Dockerfile'),path.join(output,'Dockerfile'));
fs.writeFileSync(path.join(output,'.dockerignore'), '**/node_modules\n**/.env\n**/.env.*\n**/*.bak*\n**/dist\n**/dist-frontend\n');
const tables = [];
class CreateTableCommand { constructor(input) { this.input = input; } }
class DescribeTableCommand { constructor(input) { this.input = input; } }
class DynamoDBClient { async send(command) { if (command instanceof CreateTableCommand) tables.push(command.input); return { Table: { TableStatus: 'ACTIVE' } }; } }
const mod = { exports: {} };
const fakeRequire = name => { if (name === '@aws-sdk/client-dynamodb') return { DynamoDBClient, CreateTableCommand, DescribeTableCommand }; if (name === 'dotenv') return { config() {} }; throw new Error('Unexpected schema import: ' + name); };
vm.runInNewContext(fs.readFileSync(path.join(output,'server/dynamodb-schema.js'),'utf8'), { require: fakeRequire, module: mod, process: { env: {} }, console: { log(){}, error(){ } }, setTimeout });
(async () => {
  await mod.exports.createTables();
  tables.push({ TableName: prefix + 'temple_rsvp', KeySchema: [{ AttributeName: 'eventId', KeyType: 'HASH' }, { AttributeName: 'rsvpId', KeyType: 'RANGE' }], AttributeDefinitions: [{ AttributeName: 'eventId', AttributeType: 'S' }, { AttributeName: 'rsvpId', AttributeType: 'S' }] });
  for (const table of tables) { table.BillingMode = 'PAY_PER_REQUEST'; delete table.ProvisionedThroughput; for (const index of table.GlobalSecondaryIndexes || []) delete index.ProvisionedThroughput; }
  fs.writeFileSync(path.join(__dirname,'tables.json'),JSON.stringify(tables,null,2));
  fs.writeFileSync(path.join(__dirname,'source-manifest.json'),JSON.stringify({ createdAt: new Date().toISOString(), prefix, files: manifest, tables: [...tableNames] },null,2));
  console.log(`Prepared ${manifest.length} source files and ${tables.length} staging table schemas.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
