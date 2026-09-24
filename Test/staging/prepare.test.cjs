const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const build = path.join(__dirname, 'build');
test('generated backend never uses browser globals for origin', () => {
  for (const name of fs.readdirSync(path.join(build, 'server'), {recursive:true})) {
    const file=path.join(build,'server',name);
    if (name.endsWith('.js') && fs.statSync(file).isFile()) assert.doesNotMatch(fs.readFileSync(file,'utf8'), /window\.location\.origin/, name);
  }
});
test('generated server installs gate and disables background scheduler',()=>{
  const server=fs.readFileSync(path.join(build,'server/server.js'),'utf8');
  assert.match(server,/require\('\.\/staging-runtime\.cjs'\)\(app\)/);
  assert.doesNotMatch(server,/require\('\.\/scheduler'\)\.start\(\)/);
});
test('all provisioned table schemas have staging prefix',()=>{
  const tables=JSON.parse(fs.readFileSync(path.join(__dirname,'tables.json')));
  assert.ok(tables.length >= 15);
  for(const table of tables) assert.ok(table.TableName.startsWith('calendarfly_staging_'));
});
test('generated copy excludes environment files and backups',()=>{
  for(const name of fs.readdirSync(build,{recursive:true})) {
    const base=path.basename(name);
    assert.ok(!base.startsWith('.env') && !/\.bak\d*$/.test(base),name);
  }
});
