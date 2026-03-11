/**
 * PremiumDashboard - WITH NAVIGATION FIXED
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';

export default function PremiumDashboard() {
  const navigate = useNavigate();
  const { user, organization, logout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  if (!user || !organization) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Top Navigation */}
      <nav className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold">
                  CF
                </div>
                <div>
                  <div className="font-bold">{organization.name}</div>
                  <div className="text-xs text-gray-400">{organization.subdomain}.calendarflyapp.com</div>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-6">
                <button 
                  onClick={() => window.location.href = '/'}
                  className="hover:text-purple-400 transition-colors"
                >
                  📅 Calendar
                </button>
                <button 
                  onClick={() => alert('Flyer Studio - Coming from your existing flyer editor!')}
                  className="hover:text-purple-400 transition-colors"
                >
                  🎨 Flyers
                </button>
                <button 
                  onClick={() => alert('Analytics - Connect your existing RSVP analytics!')}
                  className="hover:text-purple-400 transition-colors"
                >
                  📊 Analytics
                </button>
                <button 
                  onClick={() => alert('Broadcast - Connect your existing broadcast feature!')}
                  className="hover:text-purple-400 transition-colors"
                >
                  📱 Broadcast
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 hover:bg-white/10 px-4 py-2 rounded-lg transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold">
                  {user.name?.[0] || 'U'}
                </div>
                <span className="hidden md:block">{user.name || user.email}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Settings Dropdown */}
      {showSettings && (
        <div className="absolute right-6 top-20 z-50">
          <GlassCard className="p-4 w-64">
            <div className="space-y-2">
              <button
                onClick={() => navigate('/settings')}
                className="w-full text-left px-4 py-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                ⚙️ Settings
              </button>
              <button
                onClick={() => alert('Billing - Add Stripe integration here!')}
                className="w-full text-left px-4 py-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                💳 Billing
              </button>
              <button
                onClick={() => alert('Team - Add team management here!')}
                className="w-full text-left px-4 py-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                👥 Team
              </button>
              <hr className="border-white/10 my-2" />
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="w-full text-left px-4 py-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
              >
                🚪 Sign Out
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">
            Welcome back, {organization.name}! 👋
          </h1>
          <p className="text-gray-400">Here's what's happening with your temple</p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Events This Month', value: organization.usage?.events_this_month || 0, icon: '📅', color: 'from-purple-500 to-pink-500' },
            { label: 'Flyers Created', value: organization.usage?.flyers_this_month || 0, icon: '🎨', color: 'from-blue-500 to-cyan-500' },
            { label: 'RSVPs Received', value: organization.usage?.rsvp_responses_this_month || 0, icon: '✅', color: 'from-emerald-500 to-green-500' },
            { label: 'Community Size', value: '1,234', icon: '👥', color: 'from-orange-500 to-red-500' },
          ].map((stat, idx) => (
            <GlassCard key={idx} hover gradient className="p-6">
              <div className={`text-3xl mb-3 bg-gradient-to-r ${stat.color} bg-clip-text`}>
                {stat.icon}
              </div>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
            </GlassCard>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <GlassCard 
              hover 
              gradient 
              className="p-6 cursor-pointer" 
              onClick={() => window.location.href = '/'}
            >
              <div className="text-4xl mb-4">📅</div>
              <h3 className="text-xl font-bold mb-2">Open Calendar</h3>
              <p className="text-gray-400">Go to your temple calendar</p>
            </GlassCard>

            <GlassCard 
              hover 
              gradient 
              className="p-6 cursor-pointer" 
              onClick={() => alert('This will open your existing Flyer Editor!')}
            >
              <div className="text-4xl mb-4">🎨</div>
              <h3 className="text-xl font-bold mb-2">Design Flyer</h3>
              <p className="text-gray-400">Create stunning flyers with AI</p>
            </GlassCard>

            <GlassCard 
              hover 
              gradient 
              className="p-6 cursor-pointer" 
              onClick={() => alert('This will open your existing Broadcast feature!')}
            >
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-xl font-bold mb-2">Broadcast</h3>
              <p className="text-gray-400">Send to WhatsApp, Facebook, Instagram</p>
            </GlassCard>
            <GlassCard 
              hover 
              gradient 
              className="p-6 cursor-pointer" 
              onClick={() => navigate('/settings')}
            >
              <div className="text-4xl mb-4">⚙️</div>
              <h3 className="text-xl font-bold mb-2">Settings</h3>
              <p className="text-gray-400">Manage your organization</p>
            </GlassCard>
          </div>
        </div>

        {/* Plan Info */}
        <GlassCard gradient className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-2">
                {organization.plan.charAt(0).toUpperCase() + organization.plan.slice(1)} Plan
              </h3>
              <p className="text-gray-400 mb-4">
                Trial ends: {new Date(organization.trial_ends_at).toLocaleDateString()}
              </p>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Events:</span>{' '}
                  <span className="font-bold">{organization.usage?.events_this_month || 0}</span>
                  {organization.limits?.events_per_month !== -1 && 
                    <span className="text-gray-400"> / {organization.limits.events_per_month}</span>
                  }
                </div>
                <div>
                  <span className="text-gray-400">Flyers:</span>{' '}
                  <span className="font-bold">{organization.usage?.flyers_this_month || 0}</span>
                  {organization.limits?.flyers_per_month !== -1 && 
                    <span className="text-gray-400"> / {organization.limits.flyers_per_month}</span>
                  }
                </div>
              </div>
            </div>
            <div>
              <PremiumButton onClick={() => navigate('/settings')} variant="gold">
                Manage Plan
              </PremiumButton>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
