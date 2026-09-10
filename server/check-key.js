require('dotenv').config();

const key = process.env.ANTHROPIC_API_KEY || '';

console.log('--- API key diagnostic (no secret shown) ---');
console.log('Key found in env:', key.length > 0 ? 'YES' : 'NO — .env not loading it');
console.log('Length:', key.length, '(a real key is usually 100+ characters)');
console.log('Starts with "sk-ant-":', key.startsWith('sk-ant-'));
console.log('Starts with quote char:', key.startsWith('"') || key.startsWith("'"));
console.log('Ends with quote char:', key.endsWith('"') || key.endsWith("'"));
console.log('Has leading/trailing whitespace:', key !== key.trim());
console.log('Contains a newline:', key.includes('\n') || key.includes('\r'));
console.log('First 10 chars:', JSON.stringify(key.slice(0, 10)));
console.log('Last 6 chars:', JSON.stringify(key.slice(-6)));
