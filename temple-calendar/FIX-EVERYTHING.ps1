# CalendarFly Complete Fix Script
# Run this once - fixes everything

Write-Host "🚀 Fixing CalendarFly..." -ForegroundColor Cyan

$projectPath = "C:\My_Projects\temple-calendar-complete\temple-calendar\src"

# Backup existing files
Write-Host "📦 Backing up old files..." -ForegroundColor Yellow
Copy-Item "$projectPath\App.jsx" "$projectPath\App.jsx.backup" -ErrorAction SilentlyContinue
Copy-Item "$projectPath\components\Header.jsx" "$projectPath\components\Header.jsx.backup" -ErrorAction SilentlyContinue
Copy-Item "$projectPath\PremiumLogin.jsx" "$projectPath\PremiumLogin.jsx.backup" -ErrorAction SilentlyContinue
Copy-Item "$projectPath\PremiumSignup.jsx" "$projectPath\PremiumSignup.jsx.backup" -ErrorAction SilentlyContinue

# Fix 1: App.jsx
Write-Host "✅ Fixing App.jsx..." -ForegroundColor Green
@'
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useEvents } from './hooks/useEvents';
import Header from './components/Header';
import NewsFeed from './components/NewsFeed';
import CalendarNavigation from './components/CalendarNavigation';
import CalendarGrid from './components/CalendarGrid';
import AdminDashboard from './AdminDashboard';
import EditEventModal from './components/EditEventModal';
import AddEventModal from './components/AddEventModal';
import FlyerEditor from './components/FlyerEditor';
import RSVPPage from './pages/RSVPPage';
import RSVPAdmin from './pages/RSVPAdmin';
import BroadcastPage from './pages/BroadcastPage';
import PremiumLanding from './PremiumLanding';
import PremiumLogin from './PremiumLogin';
import PremiumSignup from './PremiumSignup';
import PremiumSettings from './PremiumSettings';

function CalendarPage() {
  const { isAuthenticated } = useAuth();
  const { events, getEventsByMonth, addEvent, updateEvent, deleteEvent, importEvents, clearAll } = useEvents();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDashboard, setShowDashboard] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showFlyerStudio, setShowFlyerStudio] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [flyerEvent, setFlyerEvent] = useState(null);

  const monthEvents = getEventsByMonth(currentDate.getFullYear(), currentDate.getMonth());

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg, #fffbeb 0%, #fef9f0 50%, #fff7ed 100%)" }}>
      <Header
        onShowLogin={() => {}}
        onShowDashboard={() => setShowDashboard(!showDashboard)}
        onShowBroadcast={() => setShowBroadcast(true)}
        onShowFlyerStudio={() => setShowFlyerStudio(true)}
        events={events}
      />
      <div style={{ padding:'10px 8px 20px' }}>
        {isAuthenticated && showDashboard && (
          <AdminDashboard events={events} onBulkImport={importEvents} onClearAll={clearAll} onShowAddEvent={() => setShowAddEvent(true)} />
        )}
        <div style={{ display:'grid', gridTemplateColumns: 'minmax(240px, 20%) 1fr', gap:'10px' }}>
          <NewsFeed events={monthEvents} currentDate={currentDate} />
          <div style={{ background:'white', borderRadius:14, padding:'20px 18px' }}>
            <CalendarNavigation currentDate={currentDate} onMonthChange={setCurrentDate} />
            <CalendarGrid currentDate={currentDate} events={monthEvents} onEditEvent={setEditingEvent} onDeleteEvent={(id) => deleteEvent(id)} onCreateFlyer={setFlyerEvent} isAdmin={isAuthenticated} />
          </div>
        </div>
      </div>
      {flyerEvent && <FlyerEditor event={flyerEvent} onClose={() => setFlyerEvent(null)} />}
      {showAddEvent && <AddEventModal onSave={(data) => { addEvent(data); setShowAddEvent(false); }} onClose={() => setShowAddEvent(false)} />}
      {editingEvent && <EditEventModal event={editingEvent} onSave={(id, data) => { updateEvent(id, data); setEditingEvent(null); }} onClose={() => setEditingEvent(null)} />}
      {showBroadcast && <BroadcastPage onClose={() => setShowBroadcast(false)} />}
      {showFlyerStudio && <FlyerEditor event={null} onClose={() => setShowFlyerStudio(false)} />}
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/landing" element={<PremiumLanding />} />
          <Route path="/login" element={<PremiumLogin />} />
          <Route path="/signup" element={<PremiumSignup />} />
          <Route path="/settings" element={<ProtectedRoute><PremiumSettings /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><RSVPAdmin /></ProtectedRoute>} />
          <Route path="/rsvp/:eventId" element={<RSVPPage />} />
          <Route path="/" element={<CalendarPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
'@ | Out-File -FilePath "$projectPath\App.jsx" -Encoding UTF8

Write-Host "✅ App.jsx fixed!" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 DONE! Now refresh your browser (Ctrl+R)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test these URLs:" -ForegroundColor Yellow
Write-Host "  http://localhost:5173/         - Calendar" -ForegroundColor White
Write-Host "  http://localhost:5173/landing  - Landing page" -ForegroundColor White
Write-Host "  http://localhost:5173/login    - Login" -ForegroundColor White
Write-Host "  http://localhost:5173/signup   - Signup" -ForegroundColor White
