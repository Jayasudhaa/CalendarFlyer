/**
 * App.jsx - COMPLETE with all fixes
 */
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { useEvents } from './hooks/useEvents';
// Components
import Header from './components/Header';
import NewsFeed from './components/NewsFeed';
import LoginModal from './components/LoginModal';
import CalendarNavigation from './components/CalendarNavigation';
import CalendarGrid from './components/CalendarGrid';
import AdminDashboard from './AdminDashboard';
import EditEventModal from './components/EditEventModal';
import AddEventModal from './components/AddEventModal';
import FlyerEditor from './components/FlyerEditor';
import BroadcastModal from './components/FlyerEditor/modals/BroadcastModal';
// RSVP Pages
import RSVPPage  from './pages/RSVPPage';
import RSVPAdmin from './pages/RSVPAdmin';
import BroadcastPage from './pages/BroadcastPage';


function AppContent() {
  const { isAuthenticated } = useAuth();
  const {
    events,
    getEventsByMonth,
    addEvent,
    updateEvent,
    deleteEvent,
    importEvents,
    clearAll,
    clearYear
  } = useEvents();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showBroadcastPage, setShowBroadcastPage] = useState(false);
  const [showFlyerStudio, setShowFlyerStudio] = useState(false); // NEW
  const [editingEvent, setEditingEvent] = useState(null);
  const [flyerEvent, setFlyerEvent] = useState(null);

  const monthEvents = getEventsByMonth(
    currentDate.getFullYear(),
    currentDate.getMonth()
  );

  const handleDeleteEvent = (eventId) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    if (confirm(`Are you sure you want to delete '${event.title}'?\n\nThis action cannot be undone.`)) {
      const result = deleteEvent(eventId);
      if (result.success) {
        alert(`✓ Event '${event.title}' deleted successfully!`);
      } else {
        alert('✗ Error deleting event. Please try again.');
      }
    }
  };

  const handleEditSave = (eventId, updatedData) => {
    const result = updateEvent(eventId, updatedData);
    if (result.success) {
      setEditingEvent(null);
    } else {
      alert('✗ Error updating event. Please try again.');
    }
  };

  const handleAddSave = (eventData) => {
    const result = addEvent(eventData);
    if (result.success) {
      setShowAddEvent(false);
    } else {
      alert('✗ Error adding event. Please try again.');
    }
  };

  const handleBulkImport = (importedEvents) => {
    const result = importEvents(importedEvents);
    if (result.success) {
      let msg = `✓ Imported ${result.added} new ${result.year || ''} events!`;
      if (result.skipped > 0) msg += `\n⚠ Skipped ${result.skipped} duplicates.`;
      if (result.rejected > 0) msg += `\n🚫 Blocked ${result.rejected} events from wrong year (only ${result.year} allowed).`;
      alert(msg);
      } else {
      alert(`✗ Import Failed\n\n${result.error || 'Unknown error'}\n\nPlease check:\n• File is valid JSON\n• Events are in array format [...]\n• Each event has: id, date, title, type`);
    }
  };

  const handleClearAll = () => {
    if (!confirm(`⚠️ WARNING: This will delete ALL ${events.length} events!\n\nThis action CANNOT be undone.\n\nAre you absolutely sure?`)) return;
    


    if (!confirm('This is your LAST CHANCE!\n\nClick OK to permanently delete all events, or Cancel to keep them.')) return;
    const result = clearAll();
    if (result.success) {
      alert('✓ All events have been cleared successfully!');
    } else {

      alert('✗ Error clearing events. Please try again.');


    }
  };







  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg, #fffbeb 0%, #fef9f0 50%, #fff7ed 100%)", width:"100%", overflowX:"hidden" }}>
      <Header
        onShowLogin={() => setShowLoginModal(true)}
        onShowDashboard={() => setShowDashboard(!showDashboard)}
        onShowBroadcast={() => setShowBroadcastPage(true)}
        onShowFlyerStudio={() => setShowFlyerStudio(true)}
        events={events}
                  />
      
      <div style={{
        width:'100%', maxWidth:'100vw', boxSizing:'border-box',
        padding:'10px 8px 20px',
        background:'linear-gradient(160deg,#fffbeb 0%,#fef9f0 60%,#fff7ed 100%)',
      }}>

        {isAuthenticated() && showDashboard && (
          <div style={{ marginBottom:12 }}>
          <AdminDashboard 
            events={events}
            onBulkImport={handleBulkImport}
            onClearAll={handleClearAll}
              onShowAddEvent={() => setShowAddEvent(true)}
          />
          </div>
        )}

        <div style={{
          display:'grid',
          gridTemplateColumns: 'minmax(240px, 20%) 1fr',
          gap:'10px',
          alignItems:'start',
          width:'100%',
        }}>

          <div style={{ position:'sticky', top:10, minWidth:0 }}>
            <NewsFeed events={monthEvents} currentDate={currentDate} />
          </div>
          
          <div style={{
            background:'white', borderRadius:14,
            boxShadow:'0 4px 20px rgba(0,0,0,0.07)',
            padding:'20px 18px', minWidth:0, overflow:'hidden',
          }}>
          <CalendarNavigation
            currentDate={currentDate}
            onMonthChange={setCurrentDate}
          />

          <CalendarGrid
            currentDate={currentDate}
            events={monthEvents}
            onEditEvent={setEditingEvent}
            onDeleteEvent={handleDeleteEvent}
            onCreateFlyer={setFlyerEvent}
            isAdmin={isAuthenticated()}
          />

          </div>
        </div>
      </div>


      {flyerEvent && (
        <FlyerEditor event={flyerEvent} onClose={() => setFlyerEvent(null)} />
      )}

      <div className="bg-gray-800 text-white text-center p-4 mt-8">
        <p>T = Tithi | N = Nakshatra | Calendar prepared for Denver, CO time</p>
        <p className="mt-2 text-sm text-gray-400">
          For updated dates and information, please check www.svtempleco.org
        </p>
      </div>

      {showAddEvent && (
        <AddEventModal onSave={handleAddSave} onClose={() => setShowAddEvent(false)} />
      )}
      {editingEvent && (
        <EditEventModal event={editingEvent} onSave={handleEditSave} onClose={() => setEditingEvent(null)} />
      )}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}
      {showBroadcast && (
        <BroadcastModal onClose={() => setShowBroadcast(false)} />
      )}
      {showBroadcastPage && (
        <BroadcastPage onClose={() => setShowBroadcastPage(false)} />
      )}
      {showFlyerStudio && (
        <FlyerEditor event={null} onClose={() => setShowFlyerStudio(false)} />
      )}
    </div>
  );
}

function AdminRSVPRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated()) {
    return (
      <div style={{ minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif' }}>
        <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:12, padding:'32px 40px', textAlign:'center', color:'white' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🔒</div>
          <div style={{ fontSize:'1.1rem', fontWeight:'bold', marginBottom:8 }}>Admin Access Required</div>
          <div style={{ color:'#6b7280', fontSize:'0.85rem', marginBottom:20 }}>
            You must be logged in to view the RSVP dashboard.
          </div>
          <a href="/" style={{ padding:'10px 24px', background:'#c2410c', color:'white', borderRadius:8,
            textDecoration:'none', fontWeight:'bold', fontSize:'0.9rem' }}>
            ← Go to Calendar & Login
          </a>
        </div>
      </div>
    );
  }
  return <RSVPAdmin />;
}

function App() {
  return (
    <BrowserRouter>
    <AuthProvider>
        <Routes>
          <Route path="/rsvp/:eventId" element={<RSVPPage />} />
          <Route path="/admin/rsvp/:eventId" element={<AdminRSVPRoute />} />
          <Route path="*" element={<AppContent />} />
        </Routes>
    </AuthProvider>
    </BrowserRouter>
  );
}
export default App;
