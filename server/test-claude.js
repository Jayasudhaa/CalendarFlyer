/**
 * test-claude.js — isolated test of the exact API call chat.js makes.
 * Run from the server/ folder: node test-claude.js
 * Requires ANTHROPIC_API_KEY to be set (either in your shell env,
 * or uncomment the require('dotenv') line below if you use a .env file).
 */

 require('dotenv').config(); // uncomment if ANTHROPIC_API_KEY lives in server/.env

const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function main() {
  console.log('Calling Claude with model: claude-sonnet-5 ...\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 250,
    system: 'You are a friendly temple assistant. Answer in 2-4 sentences.',
    messages: [{ role: 'user', content: 'What events are happening this week?' }],
  });

  console.log('--- FULL response.content array (this is the important part) ---');
  console.log(JSON.stringify(response.content, null, 2));

  console.log('\n--- Block types found ---');
  (response.content || []).forEach((block, i) => {
    console.log(`  [${i}] type: ${block.type}`);
  });

  const textBlock = response.content?.find(b => b.type === 'text');
  console.log('\n--- Extracted reply text ---');
  console.log(textBlock?.text || '(NO TEXT BLOCK FOUND — this is the bug)');
}

main().catch(err => {
  console.error('\n--- ERROR (this means the model/API call itself failed) ---');
  console.error(err.message);
  if (err.status) console.error('HTTP status:', err.status);
});
