// This copy is deliberately local-only. Staging needs its own AWS resources.
function validate(env) {
  if (env.APP_ENV !== 'local') throw new Error('Test copy requires APP_ENV=local. Use the isolated Docker Compose setup.');
  if (env.AWS_ENDPOINT_URL_DYNAMODB !== 'http://dynamodb:8000') throw new Error('Test database must be the isolated dynamodb container.');
  if (env.AWS_ACCESS_KEY_ID !== 'localtest' || env.AWS_SECRET_ACCESS_KEY !== 'localtest') throw new Error('Real AWS credentials are forbidden in this test copy.');
  if (env.ADMIN_PASSWORD && env.ADMIN_PASSWORD !== 'local-test-password') throw new Error('Only the local test administrator password is allowed.');
  const forbidden = Object.keys(env).filter(k => /SECRET|TOKEN|API_KEY|PASSWORD|ACCESS_KEY|CREDENTIAL|PROFILE/.test(k) && env[k] && !['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'JWT_SECRET', 'SESSION_SECRET', 'ADMIN_PASSWORD'].includes(k));
  if (forbidden.length) throw new Error('Remove external service credentials: ' + forbidden.join(', '));
}
module.exports = { validate };
