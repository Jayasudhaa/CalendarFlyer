/**
 * PremiumApp.jsx - Complete app with all routes
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';

// Premium pages
import PremiumLanding from './PremiumLanding';
import PremiumLogin from './PremiumLogin';
import PremiumSignup from './PremiumSignup';
import PremiumDashboard from './PremiumDashboard';
import PremiumSettings from './PremiumSettings';

// Existing temple calendar components
import Header from './components/Header';
import NewsFeed from './components/NewsFeed';
import CalendarNavigation from './components/CalendarNavigation';
import CalendarGrid from './components/CalendarGrid';
// ... rest of your imports

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return children;
}

// Public route wrapper (redirect to dashboard if logged in)
function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<PublicRoute><PremiumLanding /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><PremiumLogin /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><PremiumSignup /></PublicRoute>} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedRoute><PremiumDashboard /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><PremiumSettings /></ProtectedRoute>} />
          
          {/* Calendar route - can be public or protected based on your needs */}
          <Route path="/calendar" element={<ProtectedRoute><div>Your existing calendar component here</div></ProtectedRoute>} />
          
          {/* Existing RSVP routes */}
          <Route path="/rsvp/:eventId" element={<div>RSVP Page</div>} />
          <Route path="/admin/rsvp/:eventId" element={<ProtectedRoute><div>RSVP Admin</div></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
