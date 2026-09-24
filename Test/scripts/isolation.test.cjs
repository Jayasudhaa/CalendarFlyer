const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../server/test-environment.cjs');
const local = { APP_ENV: 'local', AWS_ENDPOINT_URL_DYNAMODB: 'http://dynamodb:8000', AWS_ACCESS_KEY_ID: 'localtest', AWS_SECRET_ACCESS_KEY: 'localtest' };
test('accepts isolated local configuration', () => assert.doesNotThrow(() => validate(local)));
test('rejects production endpoint', () => assert.throws(() => validate({ ...local, AWS_ENDPOINT_URL_DYNAMODB: 'https://dynamodb.us-east-2.amazonaws.com' })));
test('rejects real credentials', () => assert.throws(() => validate({ ...local, AWS_ACCESS_KEY_ID: 'real-key' })));
test('rejects payment credentials', () => assert.throws(() => validate({ ...local, STRIPE_SECRET_KEY: 'sk_live_example' })));
test('rejects cloud startup', () => assert.throws(() => validate({ ...local, APP_ENV: 'staging' })));
