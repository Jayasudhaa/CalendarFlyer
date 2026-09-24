/**
 * One-off admin utility: directly reset a user's password in DynamoDB.
 *
 * Why this exists: the app currently has no "forgot password" flow at all
 * (the login page's "Forgot password?" link is a dead `href="#"` — it does
 * nothing). Until that's built, this is the only way to get back into an
 * account whose password is lost, short of editing DynamoDB by hand in
 * the AWS console.
 *
 * Run this yourself, directly on your machine (NOT through Claude / the
 * device bridge) — it needs real network access to AWS, and it's the one
 * place you type your new password, so it should never pass through chat.
 *
 * Usage (from the server/ directory):
 *   node scripts/reset-password.js you@example.com "YourNewPassword123"
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const AWS = require('aws-sdk');

const [, , email, newPassword] = process.argv;

if (!email || !newPassword) {
  console.error('Usage: node scripts/reset-password.js <email> <newPassword>');
  process.exit(1);
}
if (newPassword.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const dynamodb = new AWS.DynamoDB.DocumentClient({ endpoint: process.env.AWS_ENDPOINT_URL_DYNAMODB, region: process.env.AWS_REGION || 'us-east-2' });

(async () => {
  try {
    const result = await dynamodb.query({
      TableName: 'calendarfly_users',
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :e',
      ExpressionAttributeValues: { ':e': email },
    }).promise();

    if (!result.Items || result.Items.length === 0) {
      // Try a case-insensitive scan too, since login looks up the email
      // with an exact match and this app doesn't normalize case anywhere.
      console.log(`No exact match for "${email}". Checking for a case-insensitive match...`);
      const scan = await dynamodb.scan({ TableName: 'calendarfly_users' }).promise();
      const ci = (scan.Items || []).filter(u => (u.email || '').toLowerCase() === email.toLowerCase());
      if (ci.length === 0) {
        console.error(`No account found with that email at all (checked ${scan.Items.length} users). This is why login says "Invalid credentials" — the account doesn't exist under this exact address in this table.`);
        process.exit(1);
      }
      console.log(`Found ${ci.length} case-insensitive match(es):`);
      ci.forEach(u => console.log(`  - stored as "${u.email}" (user_id: ${u.user_id}, role: ${u.role})`));
      console.log('Re-run this script with the email exactly as stored above.');
      process.exit(1);
    }

    const user = result.Items[0];
    console.log(`Found account: ${user.email} (role: ${user.role}, org_id: ${user.org_id}, email_verified: ${user.email_verified === false ? 'NO' : 'yes'})`);

    const password_hash = await bcrypt.hash(newPassword, 10);
    await dynamodb.update({
      TableName: 'calendarfly_users',
      Key: { user_id: user.user_id },
      UpdateExpression: 'SET password_hash = :h, updated_at = :now',
      ExpressionAttributeValues: { ':h': password_hash, ':now': new Date().toISOString() },
    }).promise();

    console.log('Password updated successfully. You can log in with the new password now.');
    if (user.email_verified === false) {
      console.log('Note: this account is also marked as NOT email-verified, which will separately block login with "Please verify your email before signing in". Say the word if you want this script to also clear that flag.');
    }
  } catch (e) {
    console.error('Failed:', e.message);
    process.exit(1);
  }
})();
