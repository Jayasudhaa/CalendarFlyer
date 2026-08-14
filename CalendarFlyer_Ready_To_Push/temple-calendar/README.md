# Sri Venkateswara Temple Cloud Calendar System

A modern, cloud-based calendar system for managing temple events with admin capabilities.

## Features

### 🎯 Core Features
- **Interactive Calendar View**: Monthly grid view with all events
- **Event Management**: Add, edit, and delete events
- **Admin Dashboard**: Secure admin login to manage calendar
- **Cloud Storage**: All events stored in the cloud (via Anthropic API)
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Event Types**: Pooja, Abhishekam, Kalyanam, Festival, Holiday
- **Hindu Calendar Info**: Tithi and Nakshatra details for each event

### 👨‍💼 Admin Features
- Secure password-protected admin mode
- Add new events with full details
- Edit existing events
- Delete events
- Real-time updates

### 📱 User Features
- View monthly calendar
- See all events for each day
- Browse important events list
- Navigate between months
- Mobile-friendly interface

## Installation

### Prerequisites
- Node.js 16+ installed
- npm or yarn package manager

### Setup Instructions

1. **Install Dependencies**
```bash
cd temple-calendar
npm install
```

2. **Run Development Server**
```bash
npm run dev
```

The app will open at `http://localhost:3000`

3. **Build for Production**
```bash
npm run build
```

## Admin Access

**Default Admin Password**: `temple2026`

To change the password, edit line 93 in `src/App.jsx`:
```javascript
if (password === 'YOUR_NEW_PASSWORD') {
```

## Cloud Storage Setup

This system uses Claude's API for cloud storage. The events are stored and retrieved using AI-powered persistence.

### Storage Structure
```javascript
{
  id: 'unique-id',
  date: '2026-01-14',
  title: 'Makara Sankranti',
  time: '10:00 AM',
  type: 'festival',
  tithi: 'Dwadasi 7:45 AM',
  nakshatra: 'Jyeshta 5:05 PM'
}
```

## Deployment Options

### Option 1: Vercel (Recommended)
1. Push code to GitHub
2. Import project in Vercel
3. Deploy automatically

### Option 2: Netlify
1. Push code to GitHub
2. New site from Git
3. Build command: `npm run build`
4. Publish directory: `dist`

### Option 3: Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

### Option 4: AWS Amplify
1. Connect GitHub repository
2. Configure build settings
3. Deploy

## Customization

### Change Temple Information
Edit the `templeInfo` object in `src/App.jsx`:
```javascript
const templeInfo = {
  name: "Your Temple Name",
  address: "Your Address",
  website: "www.yourwebsite.org",
  phone: "123 456 7890",
  manager: "123 456 7890",
  email: "email@temple.org"
};
```

### Change Color Theme
Edit Tailwind classes in the component:
- Header: `from-orange-600 to-red-600`
- Calendar: `bg-orange-100`, `hover:bg-orange-200`
- Buttons: `bg-orange-600`

### Add More Event Types
In the `EventCard` component, add to `typeColors`:
```javascript
const typeColors = {
  pooja: 'bg-orange-100 border-orange-300',
  // Add your type here
  special: 'bg-indigo-100 border-indigo-300'
};
```

## API Integration

### Current Setup
The app uses Anthropic's Claude API for storage. Each operation (load, save, delete) makes an API call.

### Alternative Backend Options

#### 1. Firebase Realtime Database
```javascript
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get } from 'firebase/database';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Save event
await set(ref(db, `events/${eventId}`), eventData);

// Load events
const snapshot = await get(ref(db, 'events'));
const events = snapshot.val();
```

#### 2. Supabase
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Save event
await supabase.from('events').insert(eventData);

// Load events
const { data } = await supabase.from('events').select('*');
```

#### 3. MongoDB Atlas
```javascript
// Backend API endpoint
app.post('/api/events', async (req, res) => {
  const event = new Event(req.body);
  await event.save();
  res.json(event);
});
```

## Event Data Migration

### Import from PDF
To import your existing PDF calendar data:

1. Create a JSON file with all events:
```json
[
  {
    "id": "1",
    "date": "2026-01-01",
    "title": "New Year Day",
    "time": "All Day",
    "type": "holiday",
    "tithi": "Trayodasi 9:52 AM",
    "nakshatra": "Rohini 10:17 AM"
  }
]
```

2. Use the admin interface to bulk upload
3. Or programmatically insert via API

## Security Considerations

### Production Security Checklist
- [ ] Change default admin password
- [ ] Implement proper authentication (JWT, OAuth)
- [ ] Add rate limiting
- [ ] Use HTTPS only
- [ ] Implement CORS properly
- [ ] Sanitize user inputs
- [ ] Add audit logging
- [ ] Set up backup system

### Recommended Authentication
For production, replace simple password check with:
- Firebase Authentication
- Auth0
- AWS Cognito
- Custom JWT system

## Maintenance

### Regular Tasks
- **Weekly**: Review and approve upcoming events
- **Monthly**: Backup event database
- **Quarterly**: Update temple information if needed
- **Yearly**: Archive past events

### Backup Strategy
Export all events monthly:
```javascript
const exportEvents = () => {
  const data = JSON.stringify(events, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `temple-events-backup-${new Date().toISOString()}.json`;
  a.click();
};
```

## Troubleshooting

### Events not loading?
- Check network connection
- Verify API credentials
- Check browser console for errors

### Admin login not working?
- Verify password is correct
- Clear browser cache
- Check for JavaScript errors

### Calendar not displaying correctly?
- Clear browser cache
- Try different browser
- Check responsive design settings

## Support

For technical support:
- Email: manager@svtempleco.org
- Phone: 303 898 5514

## Future Enhancements

Potential features to add:
- [ ] Email notifications for upcoming events
- [ ] SMS reminders
- [ ] Multi-language support (Telugu, Tamil, Hindi)
- [ ] Event registration system
- [ ] Photo gallery for each event
- [ ] Live streaming integration
- [ ] Donation management
- [ ] Volunteer scheduling
- [ ] Push notifications
- [ ] Calendar export (iCal format)
- [ ] Print-friendly view
- [ ] Event search and filter
- [ ] Yearly view
- [ ] Event recurrence rules

## License

Copyright © 2026 Sri Venkateswara Swamy Temple of Colorado
All rights reserved.

## Contributors

- Initial Development: Temple Management Team
- Cloud Integration: Technical Team
- Design: Community Volunteers

---

**Version**: 1.0.0  
**Last Updated**: February 2026  
**Maintained by**: Sri Venkateswara Temple IT Team
