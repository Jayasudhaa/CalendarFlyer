/**
 * ModeSelection - Choose between Public Mode or Admin Mode after login
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Eye, Shield, Lock, ArrowRight } from 'lucide-react';

export default function ModeSelection() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated) {
    navigate('/login', { replace: true });
    return null;
  }

  const handlePublicMode = () => {
    navigate('/calendar', { replace: true });
  };

  const handleAdminModeRequest = () => {
    setShowAdminPrompt(true);
    setAdminPassword('');
    setError('');
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

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
        // Store admin mode in session
        sessionStorage.setItem('admin_mode', 'true');
        navigate('/admin', { replace: true });
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (error) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Floating orbs */}
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 70%)',
        borderRadius: '50%',
        top: '-100px',
        right: '10%',
        filter: 'blur(80px)',
        animation: 'float 8s ease-in-out infinite'
      }} />
      
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)',
        borderRadius: '50%',
        bottom: '-80px',
        left: '5%',
        filter: 'blur(80px)',
        animation: 'float 10s ease-in-out infinite reverse'
      }} />

      <div style={{ maxWidth: '900px', width: '100%', position: 'relative', zIndex: 1 }}>
        {/* Welcome Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '900',
            color: 'white',
            marginBottom: '0.5rem',
            textShadow: '0 2px 20px rgba(0,0,0,0.3)'
          }}>
            Welcome, {user?.displayName || 'Administrator'}!
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: 'rgba(255,255,255,0.9)',
            fontWeight: '500'
          }}>
            Choose how you want to access the calendar
          </p>
        </div>

        {/* Mode Selection Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem'
        }}>
          {/* PUBLIC MODE CARD */}
          <button
            onClick={handlePublicMode}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '24px',
              padding: '3rem 2rem',
              cursor: 'pointer',
              transition: 'all 0.3s',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              textAlign: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 12px 48px rgba(0, 0, 0, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)'
            }}>
              <Eye className="w-10 h-10" style={{ color: 'white' }} />
            </div>
            
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              color: 'white',
              marginBottom: '1rem'
            }}>
              Public Mode
            </h2>
            
            <p style={{
              fontSize: '1rem',
              color: 'rgba(255,255,255,0.85)',
              marginBottom: '1.5rem',
              lineHeight: '1.6'
            }}>
              View the calendar as your temple members see it. Browse events and add them to Google Calendar.
            </p>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#6ee7b7',
              fontWeight: '700',
              fontSize: '1rem'
            }}>
              Enter Public Mode
              <ArrowRight className="w-5 h-5" />
            </div>
          </button>

          {/* ADMIN MODE CARD */}
          <button
            onClick={handleAdminModeRequest}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '24px',
              padding: '3rem 2rem',
              cursor: 'pointer',
              transition: 'all 0.3s',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              textAlign: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 12px 48px rgba(0, 0, 0, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              boxShadow: '0 8px 24px rgba(249, 115, 22, 0.4)'
            }}>
              <Shield className="w-10 h-10" style={{ color: 'white' }} />
            </div>
            
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              color: 'white',
              marginBottom: '1rem'
            }}>
              Admin Mode
            </h2>
            
            <p style={{
              fontSize: '1rem',
              color: 'rgba(255,255,255,0.85)',
              marginBottom: '1.5rem',
              lineHeight: '1.6'
            }}>
              Full access to manage events, create flyers, broadcast messages, and view analytics.
            </p>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#fdba74',
              fontWeight: '700',
              fontSize: '1rem'
            }}>
              <Lock className="w-4 h-4" />
              Requires Password
            </div>
          </button>
        </div>
      </div>

      {/* ADMIN PASSWORD MODAL */}
      {showAdminPrompt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }} onClick={() => setShowAdminPrompt(false)}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '450px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              padding: '2rem',
              textAlign: 'center'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <Shield className="w-8 h-8" style={{ color: 'white' }} />
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '800',
                color: 'white',
                marginBottom: '0.5rem'
              }}>
                Admin Verification
              </h3>
              <p style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: '0.95rem'
              }}>
                Enter your password to access admin features
              </p>
            </div>

            <form onSubmit={handleAdminLogin} style={{ padding: '2rem' }}>
              {error && (
                <div style={{
                  marginBottom: '1.5rem',
                  padding: '1rem',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '12px',
                  color: '#dc2626',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#f97316'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAdminPrompt(false)}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: 'white',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    fontWeight: '700',
                    color: '#6b7280',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: loading ? '#d1d5db' : '#f97316',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    fontWeight: '800',
                    color: 'white',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#ea580c')}
                  onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#f97316')}
                >
                  {loading ? 'Verifying...' : (
                    <>
                      <Lock className="w-4 h-4" />
                      Verify & Enter
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </div>
  );
}
