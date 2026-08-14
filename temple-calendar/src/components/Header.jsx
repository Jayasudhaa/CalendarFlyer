/**
 * Header - WITH SECURE ADMIN MODE
 * FIXED: Analytics button now calls onShowAnalytics prop to show modal
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LogOut, Crown, BarChart, TrendingUp, Send, Palette, Settings, Shield, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Header = ({ onShowLogin, onShowDashboard, onShowBroadcast, onShowFlyerStudio, onShowAnalytics, events = [], adminMode = false, onToggleAdminMode }) => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  const templeInfo = {
    name: "Sri Venkateswara Swamy Temple of Colorado",
    address: "1495 South Ridge Road, Castle Rock, CO 80104",
    phone: "303 660 9555",
    manager: "303 898 5514"
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/calendar');
    }
  };
  const handleAdminModeToggle = () => {
    if (adminMode) {
      onToggleAdminMode();
    } else {
      setShowAdminPrompt(true);
      setAdminPassword('');
      setAdminError('');
    }
  };
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/auth/verify-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cf_token')}`
        },
        body: JSON.stringify({ password: adminPassword })
      });
      const data = await response.json();
      if (response.ok && data.verified) {
        setShowAdminPrompt(false);
        setAdminPassword('');
        setAdminError('');
        onToggleAdminMode();
      } else {
        setAdminError('Incorrect admin password');
      }
    } catch (error) {
      setAdminError('Verification failed. Please try again.');
    }
  };


  return (
    <div style={{
      background: 'white',
      borderBottom: '2px solid #f97316',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '1rem 1.5rem',
        maxWidth: '100%'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
              width: '48px',
              height: '48px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            fontSize: '1.5rem',
            boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)'
          }}>
            🕉️
          </div>
            <div>
                <h1 style={{
              fontSize: '1.25rem',
                fontWeight: '700',
              color: '#1f2937',
              margin: 0,
              lineHeight: 1.2
                }}>
              {templeInfo.name}
            </h1>
            </div>
          </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {!isAuthenticated ? (
              <button
                onClick={() => navigate('/login')}
                style={{
                background: '#f97316',
                color: 'white',
                padding: '0.625rem 1.25rem',
                borderRadius: '8px',
                  border: 'none',
                fontWeight: '600',
                fontSize: '0.875rem',
                  cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(249, 115, 22, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s'
                }}
              onMouseEnter={e => e.currentTarget.style.background = '#ea580c'}
              onMouseLeave={e => e.currentTarget.style.background = '#f97316'}
              >
              <Lock className="w-4 h-4" />
                Admin Login
              </button>
            ) : (
            <>
                <div style={{
                background: '#10b981',
                padding: '0.5rem 0.875rem',
                  borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                gap: '0.5rem'
                    }}>
                <Crown className="w-4 h-4" style={{ color: 'white' }} />
                <div style={{ color: 'white' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700' }}>
                      {user?.displayName || 'Administrator'}
                  </div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.9 }}>
                    {user?.email || 'premium@temple.org'}
                  </div>
                  </div>
                </div>

              <button
                onClick={handleAdminModeToggle}
                style={{
                  background: adminMode ? '#f97316' : 'white',
                  border: `2px solid #f97316`,
                  color: adminMode ? 'white' : '#f97316',
                  padding: '0.625rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  boxShadow: adminMode ? '0 2px 8px rgba(249, 115, 22, 0.4)' : 'none'
                }}
              >
                {adminMode ? <Shield className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                {adminMode ? 'Admin Mode' : 'Activate Admin'}
              </button>

                  <button
                onClick={handleLogout}
                      style={{
                  background: 'white',
                  border: '1.5px solid #fecaca',
                  color: '#dc2626',
                  padding: '0.625rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                  gap: '0.375rem',
                  transition: 'all 0.2s'
                      }}
                onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                <LogOut className="w-4 h-4" />
                Logout
                  </button>
            </>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        background: '#f9fafb',
        borderTop: '1px solid #e5e7eb'
      }}>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
          <span>📍 {templeInfo.address}</span>
          <span>📞 {templeInfo.phone}</span>
          <span>👤 Manager: {templeInfo.manager}</span>
            </div>

        {isAuthenticated && adminMode && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { icon: BarChart, label: 'Dashboard', onClick: onShowDashboard, color: '#f97316' },
                { icon: Send, label: 'Broadcast', onClick: onShowBroadcast, color: '#10b981' },
                { icon: Palette, label: 'Flyer', onClick: onShowFlyerStudio, color: '#8b5cf6' },
              { icon: TrendingUp, label: 'Analytics', onClick: onShowAnalytics, color: '#06b6d4' },
                { icon: Settings, label: 'Settings', onClick: () => navigate('/settings'), color: '#64748b' },
              ].map((btn, idx) => (
              <button 
                key={idx} 
                onClick={btn.onClick} 
                style={{ 
                  background: 'white', 
                  border: `1.5px solid ${btn.color}40`, 
                  color: btn.color, 
                  padding: '0.5rem 0.875rem', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.375rem', 
                  fontSize: '0.8rem', 
                  fontWeight: '600', 
                  transition: 'all 0.2s' 
                }} 
                onMouseEnter={e => { 
                  e.currentTarget.style.background = `${btn.color}15`; 
                  e.currentTarget.style.borderColor = btn.color; 
                }} 
                onMouseLeave={e => { 
                  e.currentTarget.style.background = 'white'; 
                  e.currentTarget.style.borderColor = `${btn.color}40`; 
                }}
              >
                <btn.icon className="w-4 h-4" />
                {btn.label}
                  </button>
              ))}
          </div>
        )}
        
        {isAuthenticated && !adminMode && (
          <div style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
            Public View • Click "Activate Admin" to enable admin features
          </div>
        )}
        
        {!isAuthenticated && (
          <div style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
            Public Calendar View
              </div>
            )}
      </div>

      {showAdminPrompt && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowAdminPrompt(false)}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Admin Verification</h3>
                  <p style={{ fontSize: '0.85rem', opacity: 0.9, margin: 0 }}>Enter your password to continue</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleAdminLogin} style={{ padding: '24px' }}>
              {adminError && (
                <div style={{ marginBottom: '16px', padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '0.875rem' }}>
                  {adminError}
                </div>
              )}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Admin Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1.5px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#f97316'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                />
                <p style={{ marginTop: '8px', fontSize: '0.75rem', color: '#6b7280' }}>
                  Enter your account password to activate admin features
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAdminPrompt(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'white',
                    border: '1.5px solid #e5e7eb',
                    color: '#6b7280',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'linear-gradient(135deg, #f97316, #ea580c)',
                    border: 'none',
                    color: 'white',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '700',
                    boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  Verify & Activate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Header;
