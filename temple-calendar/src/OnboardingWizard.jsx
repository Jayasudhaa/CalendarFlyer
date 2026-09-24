/**
 * OnboardingWizard.jsx
 * Shown once, right after signup, before a brand-new org reaches the dashboard.
 * Step 1: what kind of organization is this (category)
 * Step 2: organization details (name, address, phone, branding, logo)
 * Step 3: optionally add a few starter events
 * Existing orgs (organization.onboarding_completed !== false) skip this entirely.
 */
import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useEvents } from './hooks/useEvents';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';
import { ORG_CATEGORY_GROUPS, ORG_CATEGORY_INFO } from './utils/organizationCategories';

const STEPS = ['Org Type', 'Details', 'Events'];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, organization, updateOrganization } = useAuth();
  const { addEvent } = useEvents();

  const [step, setStep] = useState(0);
  const [category, setCategory] = useState('');
  const [details, setDetails] = useState({
    name: organization?.name || '',
    address: '',
    phone: '',
    manager_phone: '',
    primary_color: organization?.primary_color || '#f97316',
    secondary_color: organization?.secondary_color || '#fff7ed',
  });
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', description: '' });
  const [addedEvents, setAddedEvents] = useState([]);
  const [addingEvent, setAddingEvent] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');

  // Guard: must be logged in, and only new orgs that haven't finished setup get here.
  if (!authLoading && !isAuthenticated) return <Navigate to="/login" replace />;
  if (!authLoading && organization && organization.onboarding_completed !== false) {
    return <Navigate to="/admin" replace />;
  }

  const handleLogoFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setLogoError('');
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Image must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setLogoPreview(dataUrl);
      setLogoUploading(true);
      try {
        const token = localStorage.getItem('cf_token');
        const res = await fetch('/api/flyers/logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ imageData: dataUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
      } catch (err) {
        setLogoError(err.message || 'Failed to upload logo');
        setLogoPreview(null);
      } finally {
        setLogoUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.title.trim() || !newEvent.date) return;
    setAddingEvent(true);
    const result = await addEvent(newEvent);
    if (result.success) {
      if (result.duplicate) {
        setError(`"${newEvent.title}" is already on your calendar for ${newEvent.date} — not added again.`);
      } else {
        setAddedEvents(prev => [...prev, result.event]);
        setError('');
      }
      setNewEvent({ title: '', date: '', time: '', description: '' });
    } else {
      setError(result.error || 'Failed to add that event. Please try again.');
    }
    setAddingEvent(false);
  };

  const handleFinish = async () => {
    setFinishing(true);
    setError('');
    const result = await updateOrganization({
      name: details.name,
      address: details.address,
      phone: details.phone,
      manager_phone: details.manager_phone,
      primary_color: details.primary_color,
      secondary_color: details.secondary_color,
      category,
      onboarding_completed: true,
    });
    if (result.success) {
      navigate('/admin');
    } else {
      setError(result.error || 'Failed to save. Please try again.');
    }
    setFinishing(false);
  };

  const canContinueFromStep1 = !!category;
  const canContinueFromStep2 = details.name.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white px-4 py-10">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-purple-500/20 rounded-full blur-3xl top-20 left-20 animate-pulse" />
        <div className="absolute w-96 h-96 bg-blue-500/20 rounded-full blur-3xl bottom-20 right-20 animate-pulse" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-2xl">CF</div>
            <span className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">CalendarFly</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Let's set up your workspace</h1>
          <p className="text-gray-400">Just a couple of quick steps before you get to your dashboard</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-4 mb-10">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && <div className={`h-0.5 w-10 sm:w-16 ${step >= i ? 'bg-purple-500' : 'bg-gray-700'}`} />}
              <div className={`flex items-center gap-2 ${step >= i ? 'text-purple-400' : 'text-gray-600'}`}>
                <div className={`w-8 h-8 rounded-full ${step >= i ? 'bg-purple-500' : 'bg-gray-700'} flex items-center justify-center font-bold text-sm`}>{i + 1}</div>
                <span className="hidden sm:inline text-sm">{label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/50 text-red-300 text-sm">{error}</div>
        )}

        {/* Step 1 — Category */}
        {step === 0 && (
          <div>
            <GlassCard gradient className="p-6 sm:p-8 mb-6">
              <h2 className="text-xl font-bold mb-1">What kind of organization is this?</h2>
              <p className="text-gray-400 text-sm mb-6">This helps us tailor the chatbot, flyer suggestions, and defaults for you.</p>
              <div className="space-y-6">
                {ORG_CATEGORY_GROUPS.map((group) => (
                  <div key={group.title}>
                    <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">{group.title}</div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {group.keys.map((key) => {
                        const c = ORG_CATEGORY_INFO[key];
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setCategory(key)}
                            className={`text-left p-4 rounded-xl border transition-colors ${category === key ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                          >
                            <div className="text-xl mb-1">{c.icon}</div>
                            <div className="font-bold text-sm mb-0.5">{c.label}</div>
                            <div className="text-xs text-gray-400">{c.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
            <div className="text-center">
              <PremiumButton onClick={() => setStep(1)} size="lg" variant="gold" disabled={!canContinueFromStep1}>
                Continue →
              </PremiumButton>
            </div>
          </div>
        )}

        {/* Step 2 — Details */}
        {step === 1 && (
          <div>
            <GlassCard gradient className="p-6 sm:p-8 mb-6">
              <h2 className="text-xl font-bold mb-1">Tell us about your organization</h2>
              <p className="text-gray-400 text-sm mb-6">You can always change these later in Settings.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Organization Name *</label>
                  <input
                    type="text" value={details.name}
                    onChange={e => setDetails({ ...details, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="SV Temple Colorado"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Address</label>
                  <input
                    type="text" value={details.address}
                    onChange={e => setDetails({ ...details, address: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="1495 South Ridge Road, Castle Rock, CO 80104"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Phone</label>
                    <input
                      type="tel" value={details.phone}
                      onChange={e => setDetails({ ...details, phone: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="303 660 9555"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Manager Phone</label>
                    <input
                      type="tel" value={details.manager_phone}
                      onChange={e => setDetails({ ...details, manager_phone: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="303 898 5514"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Logo</label>
                  <div className="flex items-center gap-4">
                    {(logoPreview || organization?.logo_url) ? (
                      <img src={logoPreview || organization.logo_url} alt="Logo" className="w-14 h-14 rounded-lg border border-white/10 object-contain bg-white" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg border border-dashed border-white/20 flex items-center justify-center text-gray-500 text-xs text-center">No logo</div>
                    )}
                    <div>
                      <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoFileChange} className="hidden" id="onboarding-logo-input" />
                      <label htmlFor="onboarding-logo-input" className="inline-block px-4 py-2 rounded-lg border border-white/20 text-sm font-semibold cursor-pointer hover:bg-white/5">
                        {logoUploading ? 'Uploading…' : 'Choose image (optional)'}
                      </label>
                      {logoError && <p className="text-xs text-red-400 mt-1">{logoError}</p>}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Primary Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={details.primary_color} onChange={e => setDetails({ ...details, primary_color: e.target.value })} className="w-12 h-10 rounded-lg border border-white/10 cursor-pointer" />
                      <input type="text" value={details.primary_color} onChange={e => setDetails({ ...details, primary_color: e.target.value })} className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Secondary Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={details.secondary_color} onChange={e => setDetails({ ...details, secondary_color: e.target.value })} className="w-12 h-10 rounded-lg border border-white/10 cursor-pointer" />
                      <input type="text" value={details.secondary_color} onChange={e => setDetails({ ...details, secondary_color: e.target.value })} className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setStep(0)} className="text-gray-400 hover:text-white text-sm">← Back</button>
              <PremiumButton onClick={() => setStep(2)} size="lg" variant="gold" disabled={!canContinueFromStep2}>
                Continue →
              </PremiumButton>
            </div>
          </div>
        )}

        {/* Step 3 — Events (optional) */}
        {step === 2 && (
          <div>
            <GlassCard gradient className="p-6 sm:p-8 mb-6">
              <h2 className="text-xl font-bold mb-1">Add your first events</h2>
              <p className="text-gray-400 text-sm mb-6">Optional — add a few now, or skip and add them later from the dashboard.</p>

              {addedEvents.length > 0 && (
                <ul className="mb-5 space-y-2">
                  {addedEvents.map(ev => (
                    <li key={ev.id} className="flex items-center gap-2 text-sm bg-white/5 rounded-lg px-3 py-2">
                      <span className="text-emerald-400">✓</span>
                      <span className="font-semibold">{ev.title}</span>
                      <span className="text-gray-400">— {ev.date}{ev.time ? ` · ${ev.time}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={handleAddEvent} className="space-y-3">
                <input
                  type="text" value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Event title"
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    type="date" value={newEvent.date}
                    onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    type="text" value={newEvent.time}
                    onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Time (e.g. 10:00 AM)"
                  />
                </div>
                <textarea
                  value={newEvent.description} rows={2}
                  onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Description (optional)"
                />
                <PremiumButton type="submit" variant="secondary" disabled={addingEvent || !newEvent.title.trim() || !newEvent.date}>
                  {addingEvent ? 'Adding…' : '+ Add Another Event'}
                </PremiumButton>
              </form>
            </GlassCard>

            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setStep(1)} className="text-gray-400 hover:text-white text-sm">← Back</button>
              <PremiumButton onClick={handleFinish} size="lg" variant="gold" disabled={finishing}>
                {finishing ? 'Setting up…' : addedEvents.length > 0 ? 'Finish Setup →' : 'Skip & Finish Setup →'}
              </PremiumButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
