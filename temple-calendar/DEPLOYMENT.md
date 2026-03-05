# Deployment Guide for Temple Calendar

## Quick Start Deployment

### Option 1: Deploy to Vercel (Easiest - 5 minutes)

1. **Prepare Your Code**
   ```bash
   # Make sure everything is committed
   git init
   git add .
   git commit -m "Initial temple calendar"
   ```

2. **Push to GitHub**
   - Create new repository on GitHub
   - Push your code:
   ```bash
   git remote add origin https://github.com/yourusername/temple-calendar.git
   git push -u origin main
   ```

3. **Deploy on Vercel**
   - Go to https://vercel.com
   - Click "Import Project"
   - Select your GitHub repository
   - Click "Deploy"
   - Done! You'll get a URL like: `temple-calendar.vercel.app`

**Advantages**: Automatic HTTPS, CDN, instant deploys, free tier

---

## Option 2: Firebase Hosting (Free, Fast)

### Setup (One-time)
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
cd temple-calendar
firebase init hosting
```

When prompted:
- Public directory: `dist`
- Single-page app: `Yes`
- GitHub deploys: `No` (for now)

### Deploy
```bash
# Build the project
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

Your site will be live at: `your-project.web.app`

**Advantages**: Google infrastructure, free tier, custom domains

---

## Option 3: Netlify (Great for Continuous Deployment)

### Method A: Drag and Drop
1. Run `npm run build`
2. Go to https://netlify.com
3. Drag the `dist` folder to Netlify
4. Done!

### Method B: Git Integration
1. Push code to GitHub
2. New site from Git on Netlify
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy!

**Advantages**: Free SSL, forms, functions, preview deploys

---

## Option 4: Traditional Web Hosting (cPanel/Shared Hosting)

If you have traditional web hosting:

1. **Build the project locally**
   ```bash
   npm run build
   ```

2. **Upload via FTP**
   - Upload all files from the `dist` folder
   - Upload to your `public_html` or `www` directory

3. **Configure .htaccess** (for single-page app routing)
   Create `.htaccess` in your upload directory:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

**Advantages**: Use existing hosting, full control

---

## Setting Up a Database Backend

### Option A: Firebase (Recommended for Beginners)

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com
   - Create new project
   - Enable Realtime Database

2. **Install Firebase SDK**
   ```bash
   npm install firebase
   ```

3. **Create Firebase Config**
   Create `src/firebase.js`:
   ```javascript
   import { initializeApp } from 'firebase/app';
   import { getDatabase } from 'firebase/database';

   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     databaseURL: "https://YOUR_PROJECT.firebaseio.com",
     projectId: "YOUR_PROJECT",
     storageBucket: "YOUR_PROJECT.appspot.com",
     messagingSenderId: "YOUR_MESSAGING_ID",
     appId: "YOUR_APP_ID"
   };

   const app = initializeApp(firebaseConfig);
   export const database = getDatabase(app);
   ```

4. **Update App.jsx** to use Firebase:
   ```javascript
   import { database } from './firebase';
   import { ref, set, get, remove } from 'firebase/database';

   // Load events
   const loadEvents = async () => {
     const eventsRef = ref(database, 'events');
     const snapshot = await get(eventsRef);
     if (snapshot.exists()) {
       setEvents(Object.values(snapshot.val()));
     }
   };

   // Save event
   const saveEvent = async (event) => {
     await set(ref(database, `events/${event.id}`), event);
     await loadEvents();
   };

   // Delete event
   const deleteEvent = async (eventId) => {
     await remove(ref(database, `events/${eventId}`));
     await loadEvents();
   };
   ```

### Option B: Supabase (SQL Database, Free Tier)

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Create new project
   - Create `events` table with columns:
     - id (text, primary key)
     - date (date)
     - title (text)
     - time (text)
     - type (text)
     - tithi (text)
     - nakshatra (text)

2. **Install Supabase**
   ```bash
   npm install @supabase/supabase-js
   ```

3. **Create Supabase Config**
   Create `src/supabase.js`:
   ```javascript
   import { createClient } from '@supabase/supabase-js';

   const supabaseUrl = 'YOUR_SUPABASE_URL';
   const supabaseKey = 'YOUR_ANON_KEY';
   
   export const supabase = createClient(supabaseUrl, supabaseKey);
   ```

4. **Update functions**:
   ```javascript
   import { supabase } from './supabase';

   const loadEvents = async () => {
     const { data, error } = await supabase
       .from('events')
       .select('*')
       .order('date');
     if (data) setEvents(data);
   };

   const saveEvent = async (event) => {
     await supabase.from('events').upsert(event);
     await loadEvents();
   };

   const deleteEvent = async (eventId) => {
     await supabase.from('events').delete().eq('id', eventId);
     await loadEvents();
   };
   ```

### Option C: MongoDB Atlas (NoSQL, Free Tier)

1. **Create MongoDB Atlas Cluster**
   - Go to https://www.mongodb.com/cloud/atlas
   - Create free cluster
   - Create database user
   - Whitelist IP address (0.0.0.0/0 for all)

2. **Create Backend API** (Node.js + Express)
   Create `backend/server.js`:
   ```javascript
   const express = require('express');
   const { MongoClient } = require('mongodb');
   const cors = require('cors');

   const app = express();
   app.use(cors());
   app.use(express.json());

   const uri = "YOUR_MONGODB_CONNECTION_STRING";
   const client = new MongoClient(uri);

   app.get('/api/events', async (req, res) => {
     const events = await client.db('temple').collection('events').find().toArray();
     res.json(events);
   });

   app.post('/api/events', async (req, res) => {
     const result = await client.db('temple').collection('events').insertOne(req.body);
     res.json(result);
   });

   app.delete('/api/events/:id', async (req, res) => {
     await client.db('temple').collection('events').deleteOne({ id: req.params.id });
     res.json({ success: true });
   });

   app.listen(3001, () => console.log('Server running on port 3001'));
   ```

3. **Update frontend** to use backend API

---

## Custom Domain Setup

### For Vercel
1. Go to project settings
2. Add custom domain
3. Update DNS records as instructed

### For Firebase
```bash
firebase hosting:channel:deploy production --only hosting
```
Then add custom domain in Firebase Console

### For Netlify
1. Site settings → Domain management
2. Add custom domain
3. Configure DNS

---

## Environment Variables

For security, use environment variables:

1. **Create `.env` file** (don't commit this!):
   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_ADMIN_PASSWORD=your_admin_password
   ```

2. **Use in code**:
   ```javascript
   const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
   ```

3. **Add to `.gitignore`**:
   ```
   .env
   .env.local
   ```

---

## SSL Certificate (HTTPS)

All recommended hosting options provide free SSL:
- Vercel: Automatic
- Netlify: Automatic
- Firebase: Automatic

For traditional hosting, use Let's Encrypt (free) via cPanel.

---

## Monitoring and Analytics

### Add Google Analytics
1. Create GA4 property
2. Add to `index.html`:
   ```html
   <!-- Google tag (gtag.js) -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'G-XXXXXXXXXX');
   </script>
   ```

---

## Backup Strategy

### Automated Backups with Firebase
```javascript
// Add to admin dashboard
const backupDatabase = async () => {
  const snapshot = await get(ref(database, 'events'));
  const data = JSON.stringify(snapshot.val(), null, 2);
  
  // Save to file
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-${new Date().toISOString()}.json`;
  a.click();
};
```

---

## Troubleshooting Deployment

### Build fails?
- Check Node version: `node --version` (need 16+)
- Clear cache: `rm -rf node_modules package-lock.json && npm install`
- Check for errors in console

### Site deployed but blank?
- Check browser console for errors
- Verify build files in `dist` folder
- Check .htaccess for routing

### Database connection fails?
- Verify API keys
- Check CORS settings
- Verify firewall rules

---

## Cost Estimates

| Service | Free Tier | Paid Plans |
|---------|-----------|------------|
| Vercel | 100GB bandwidth/month | $20/month |
| Netlify | 100GB bandwidth/month | $19/month |
| Firebase | 10GB storage, 50K reads/day | Pay as you go |
| Supabase | 500MB DB, 2GB bandwidth | $25/month |

**Recommendation**: Start with free tiers, upgrade if needed

---

## Next Steps After Deployment

1. ✅ Test all functionality
2. ✅ Add admin user
3. ✅ Import existing events
4. ✅ Configure custom domain
5. ✅ Set up SSL
6. ✅ Add analytics
7. ✅ Create backup schedule
8. ✅ Train admin users
9. ✅ Document processes
10. ✅ Announce to community

---

## Support

Need help deploying? Contact:
- Email: manager@svtempleco.org
- Phone: 303 898 5514

Or consult the hosting provider's documentation:
- Vercel: https://vercel.com/docs
- Firebase: https://firebase.google.com/docs
- Netlify: https://docs.netlify.com
