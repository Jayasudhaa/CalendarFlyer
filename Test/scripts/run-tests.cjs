const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
let failed = false;
const projects = process.argv[2] ? [process.argv[2]] : ['server', 'temple-calendar'];
if (projects.some(p => !['server', 'temple-calendar'].includes(p))) throw new Error('Unknown test project');
for (const project of projects) {
  const cwd = path.join(root, project);
  const runner = path.join(cwd, 'node_modules/vitest/vitest.mjs');
  if (!fs.existsSync(runner)) { console.error(`Install dependencies first: cd ${cwd} then npm ci`); failed = true; continue; }
  const result = spawnSync(process.execPath, [runner, 'run', '--maxWorkers=2'], {
    cwd, encoding: 'utf8', timeout: 300000, maxBuffer: 30 * 1024 * 1024,
    env: { ...process.env, NODE_ENV: 'test', AWS_ACCESS_KEY_ID: 'localtest', AWS_SECRET_ACCESS_KEY: 'localtest', AWS_EC2_METADATA_DISABLED: 'true', AWS_ENDPOINT_URL_DYNAMODB: 'http://127.0.0.1:1' }
  });
  const output = (result.stdout || '') + (result.stderr || '') + (result.error ? result.error.message : '');
  fs.writeFileSync(path.join(root, 'reports', `${project}-tests.txt`), output);
  console.log(project + ': ' + (result.status === 0 ? 'PASS' : 'FAIL') + ' (full output in reports/' + project + '-tests.txt)');
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
