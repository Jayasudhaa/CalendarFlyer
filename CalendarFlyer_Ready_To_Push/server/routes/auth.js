const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-2'
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this-in-production';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};
router.post('/signup', async (req, res) => {
  const { email, password, displayName, organizationName } = req.body;
  try {
// Add this route to your existing auth.js file:
    const existingUser = await dynamodb.query({
      TableName: 'calendarfly_users',
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email }
    }).promise();

    if (existingUser.Items && existingUser.Items.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const orgId = `org-${uuidv4()}`;
    const userId = `user-${uuidv4()}`;
    const organization = {
      org_id: orgId,
      name: organizationName || `${displayName}'s Organization`,
      subdomain: email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, ''),
      primary_color: '#f97316',
      secondary_color: '#fff7ed',
      plan: 'free',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await dynamodb.put({
      TableName: 'calendarfly_organizations',
      Item: organization
    }).promise();
    const user = {
      user_id: userId,
      org_id: orgId,
      email,
      password_hash: passwordHash,
      display_name: displayName || email.split('@')[0],
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await dynamodb.put({
      TableName: 'calendarfly_users',
      Item: user
    }).promise();
    const token = jwt.sign(
      { user_id: userId, org_id: orgId, email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: {
        user_id: userId,
        email,
        displayName: user.display_name,
        role: 'admin'
      },
      organization: {
        org_id: orgId,
        name: organization.name,
        subdomain: organization.subdomain
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await dynamodb.query({
      TableName: 'calendarfly_users',
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email }
    }).promise();
    if (!result.Items || result.Items.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.Items[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const orgResult = await dynamodb.get({
      TableName: 'calendarfly_organizations',
      Key: { org_id: user.org_id }
    }).promise();
    const organization = orgResult.Item;
    const token = jwt.sign(
      { user_id: user.user_id, org_id: user.org_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      },
      organization: organization ? {
        org_id: organization.org_id,
        name: organization.name,
        subdomain: organization.subdomain,
        primary_color: organization.primary_color,
        secondary_color: organization.secondary_color
      } : null
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});
router.post('/verify-admin', authenticateToken, async (req, res) => {
  const { password } = req.body;








  const userId = req.user.user_id;



  try {
    // Get user from database


    const result = await dynamodb.get({
      TableName: 'calendarfly_users',
      Key: { user_id: userId }
    }).promise();

    if (!result.Item) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.Item;

    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (isValid) {
      res.json({ verified: true });
    } else {
      res.status(401).json({ verified: false, error: 'Invalid password' });
    }




  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await dynamodb.get({
      TableName: 'calendarfly_users',
      Key: { user_id: req.user.user_id }
    }).promise();
    if (!result.Item) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = result.Item;
    const orgResult = await dynamodb.get({
      TableName: 'calendarfly_organizations',
      Key: { org_id: user.org_id }
    }).promise();
    res.json({
      user: {
        user_id: user.user_id,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      },
      organization: orgResult.Item || null
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});
module.exports = router;
