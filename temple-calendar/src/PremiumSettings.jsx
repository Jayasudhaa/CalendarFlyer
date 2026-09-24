/**
 * PremiumSettings - Complete Settings Page
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useEvents } from './hooks/useEvents';
import { getTemplateEvents, CATEGORY_TEMPLATE_LABELS, CATEGORY_TEMPLATE_PREVIEW } from './utils/eventTemplates';
import { ORG_CATEGORY_GROUPS, ORG_CATEGORY_INFO } from './utils/organizationCategories';
import { ArrowLeft, Building2, Globe, Palette, CreditCard, Phone, MapPin, Save, Upload, Share2, Bot, HelpCircle } from 'lucide-react';

const SETTINGS_TABS = [
  { key: 'organization', label: 'Organization', icon: Building2 },
  { key: 'branding',     label: 'Branding',     icon: Palette },
  { key: 'import',       label: 'Import Events', icon: Upload },
  { key: 'social',       label: 'Social Media',  icon: Share2 },
  { key: 'subscription', label: 'Subscription',  icon: CreditCard },
  // Moved here from the admin-toolbar account menu, alongside the other
  // organization-management tools this page already groups.
  { key: 'chatbot',      label: 'Sync Chatbot',  icon: Bot },
  // Also moved here from the account menu — note this does narrow Help's
  // audience from "every logged-in role" to "owners/admins only" (Settings
  // isn't reachable by viewers), a deliberate tradeoff per request.
  { key: 'help',         label: 'Help',          icon: HelpCircle },
];
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';
import AdminToolbar from './components/AdminToolbar';
import { playClick } from './utils/sound';
import SocialConnectButtons from './components/SocialConnectButtons';
import SyncChatbotModal from './SyncChatbotModal';
import HelpPage from './components/HelpPage';

// Same soft warm-gold halo background used on the admin calendar page —
// applied consistently across every admin page (Broadcast, Flyer, Analytics,
// My Profile, Subscription, Settings) instead of each having its own look.
// Was a warm-gold radial halo (var(--cf-accent-glow) x3) — dropped for a
// flat pure-white page background as part of the black & white redesign
// (same fix as App.jsx/CalendarGrid.jsx/MyProfile.jsx).
const HALO_BG = { backgroundColor: 'var(--cf-bg-base)' };

export default function PremiumSettings() {
  const navigate = useNavigate();
  const { user, organization, updateOrganization } = useAuth();
  const { events, importEvents } = useEvents();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  // Sync Chatbot — moved here from the admin-toolbar account menu, shown
  // inline in its own tab (not a popup).
  const [syncStatus, setSyncStatus] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  // 'organization' | 'branding' | 'import' | 'social' | 'subscription' —
  // every field still lives in the same formData/state below and saves
  // together with the one Save Changes button; tabs just group the
  // sections visually instead of stacking all of them on one long page.
  // Read from ?tab= on first render — lets a deep link (e.g. AdminAssistant's
  // "connect Facebook/Instagram" action, or a future "Manage Subscription"
  // link elsewhere) land straight on the right tab instead of always opening
  // on Organization and making the admin click over themselves.
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const requested = searchParams.get('tab');
    return SETTINGS_TABS.some(t => t.key === requested) ? requested : 'organization';
  });
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [bannerPreview, setBannerPreview] = useState(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerError, setBannerError] = useState('');
  const [eventsImporting, setEventsImporting] = useState(false);
  const [eventsImportMsg, setEventsImportMsg] = useState('');
  const [eventsImportError, setEventsImportError] = useState('');
  const [panchangImporting, setPanchangImporting] = useState(false);
  const [panchangImportMsg, setPanchangImportMsg] = useState('');
  const [panchangImportError, setPanchangImportError] = useState('');
  const [categoryUnlocked, setCategoryUnlocked] = useState(false);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [adminCodeInput, setAdminCodeInput] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    category: '',
    address: '',
    zip_code: '',
    phone: '',
    primary_color: '#f97316',
    secondary_color: '#fff7ed',
    broadcast_email: '',
  });
  // Facebook/Instagram connect UI itself now lives in
  // components/SocialConnectButtons.jsx (real OAuth flow; the old manual
  // Graph-API-Explorer-paste wizard, SocialConnectWizardsOld.jsx, is still
  // reachable from a toggle inside it) — these two are still shared with WhatsApp.
  const [socialMessage, setSocialMessage] = useState('');
  const [socialError, setSocialError] = useState('');

  // App ID / Embedded Signup config ID for the WhatsApp "Connect" popup —
  // fetched from the server rather than baked into the frontend build so
  // they can change without a rebuild (see GET /whatsapp/config).
  const [waConfig, setWaConfig] = useState(null);
  const [waConnecting, setWaConnecting] = useState(false);

  // Load WhatsApp connect availability once on mount — independent of
  // `organization` below, this only needs to run once. (Facebook/Instagram's
  // own status check now lives inside SocialConnectButtons.)
  useEffect(() => {
    const token = localStorage.getItem('cf_token');
    const headers = { Authorization: `Bearer ${token}` };
    fetch('/api/social/whatsapp/config', { headers }).then(r => r.json()).then(setWaConfig).catch(() => {});
  }, []);


  // Loads Meta's JS SDK on demand (only when WhatsApp Connect is actually
  // clicked, not on every Settings page load) and resolves once FB.init()
  // has run.
  function loadFacebookSdk(appId) {
    return new Promise((resolve, reject) => {
      if (window.FB) { resolve(window.FB); return; }
      window.fbAsyncInit = function () {
        window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: 'v20.0' });
        resolve(window.FB);
      };
      if (document.getElementById('facebook-jssdk')) return; // already loading from an earlier click
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Could not load the Facebook SDK — check your connection and try again.'));
      document.body.appendChild(script);
    });
  }

  // WhatsApp Embedded Signup: Meta's popup (driven by FB.login below)
  // handles picking/creating a WhatsApp Business Account, verifying the
  // phone number by OTP, and registering it — entirely inside their UI. It
  // hands back what we need in two separate places that arrive independently:
  // the authorization code from FB.login's own callback, and the new
  // waba_id/phone_number_id from a postMessage event the popup fires. Save
  // the connection only once both have arrived.
  const handleConnectWhatsApp = async () => {
    setSocialError('');
    if (!waConfig || !waConfig.configured) {
      setSocialError("WhatsApp connection isn't set up on the server yet — see the setup notes for what's needed in the Meta App dashboard.");
      return;
    }
    setWaConnecting(true);

    let signupData = null;
    let loginCode = null;
    const finishIfReady = async () => {
      if (!signupData || !loginCode) return;
      window.removeEventListener('message', onMessage);
      try {
        const token = localStorage.getItem('cf_token');
        const res = await fetch('/api/social/whatsapp/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ code: loginCode, waba_id: signupData.waba_id, phone_number_id: signupData.phone_number_id }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Could not finish connecting WhatsApp');
        setSocialMessage('WhatsApp connected!');
        await updateOrganization({});
        setTimeout(() => setSocialMessage(''), 4000);
      } catch (err) {
        setSocialError(err.message);
      } finally {
        setWaConnecting(false);
      }
    };

    const onMessage = (event) => {
      if (event.origin !== 'https://www.facebook.com') return;
      let data;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch (e) {
        return; // not a WhatsApp signup message
      }
      if (data && data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
        signupData = data.data; // { phone_number_id, waba_id }
        finishIfReady();
      }
    };
    window.addEventListener('message', onMessage);

    try {
      const FB = await loadFacebookSdk(waConfig.appId);
      FB.login((response) => {
        if (response.authResponse && response.authResponse.code) {
          loginCode = response.authResponse.code;
          finishIfReady();
        } else {
          window.removeEventListener('message', onMessage);
          setWaConnecting(false);
          // Popup closed or declined — not an error worth surfacing.
        }
      }, {
        config_id: waConfig.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { sessionInfoVersion: '3' },
      });
    } catch (err) {
      window.removeEventListener('message', onMessage);
      setSocialError(err.message);
      setWaConnecting(false);
    }
  };

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        subdomain: organization.subdomain || '',
        category: organization.category || '',
        address: organization.address || '',
        zip_code: organization.zip_code || '',
        phone: organization.phone || '',
        primary_color: organization.primary_color || '#f97316',
        secondary_color: organization.secondary_color || '#fff7ed',
        broadcast_email: organization.broadcast_email || '',
  });
    }
  }, [organization]);

  const handleDisconnectSocial = async (platform) => {
    const label = platform === 'facebook' ? 'Facebook' : platform === 'instagram' ? 'Instagram' : 'WhatsApp';
    if (!window.confirm(`Disconnect ${label}? Broadcasts to ${label} will fall back to the shared default account, if one is configured.`)) return;

    setSocialMessage('');
    setSocialError('');
    const payload = platform === 'facebook' ? { disconnect_facebook: true }
      : platform === 'instagram' ? { disconnect_instagram: true }
      : { disconnect_whatsapp: true };
    const result = await updateOrganization(payload);
    if (result.success) {
      setSocialMessage(`${label} disconnected`);
      setTimeout(() => setSocialMessage(''), 3000);
    } else {
      setSocialError(result.error || `Failed to disconnect ${label}`);
    }
  };

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
      setLogoPreview(dataUrl); // instant preview while it uploads
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
        // Refresh organization data so organization.logo_url reflects the new upload
        await updateOrganization({});
      } catch (err) {
        setLogoError(err.message || 'Failed to upload logo');
        setLogoPreview(null);
      } finally {
        setLogoUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleBannerFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBannerError('');
    if (file.size > 8 * 1024 * 1024) {
      setBannerError('Image must be under 8MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setBannerPreview(dataUrl); // instant preview while it uploads
      setBannerUploading(true);
      try {
        const token = localStorage.getItem('cf_token');
        const res = await fetch('/api/flyers/banner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ imageData: dataUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        // Refresh organization data so organization.banner_url reflects the new upload
        await updateOrganization({});
      } catch (err) {
        setBannerError(err.message || 'Failed to upload banner');
        setBannerPreview(null);
      } finally {
        setBannerUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Shared reader for the "Import events (JSON)" and "Import panchang (JSON)"
  // file pickers below — both expect a JSON array of event-shaped objects:
  // [{ "title": "...", "date": "YYYY-MM-DD", "time": "...", "description": "..." }, ...]
  function readJsonEventsFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!Array.isArray(parsed)) {
            reject(new Error('File must contain a JSON array of events'));
            return;
          }
          const invalid = parsed.some(ev => !ev || !ev.title || !ev.date);
          if (invalid) {
            reject(new Error('Every event needs at least a "title" and a "date" (YYYY-MM-DD)'));
            return;
          }
          resolve(parsed);
        } catch (err) {
          reject(new Error('That file is not valid JSON'));
        }
      };
      reader.onerror = () => reject(new Error('Could not read that file'));
      reader.readAsText(file);
    });
  }

  const handleEventsFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = ''; // allow re-selecting the same file later
    setEventsImportError('');
    setEventsImportMsg('');
    setEventsImporting(true);
    try {
      const parsed = await readJsonEventsFile(file);
      setEventsImportMsg(`Importing 0/${parsed.length}…`);
      const result = await importEvents(parsed, ({ done, total }) => setEventsImportMsg(`Importing ${done}/${total}…`));
      if (result.success) {
        setEventsImportMsg(`Added ${result.added}, skipped ${result.skipped} already on the calendar${result.rejected ? `, ${result.rejected} failed` : ''}.`);
      } else {
        setEventsImportError('Import failed. Please try again.');
      }
    } catch (err) {
      setEventsImportError(err.message || 'Import failed.');
    } finally {
      setEventsImporting(false);
    }
  };

  // Panchang exports don't have a "title" the way regular events do — each
  // entry is just { date, tithi, nakshatra, moonPhase? }. We build a display
  // title from tithi/nakshatra (used for the calendar card headline and for
  // duplicate detection) and forward tithi/nakshatra/moonPhase through as
  // their own fields so the calendar's panchang badge can render them
  // directly instead of re-parsing a string.
  function readPanchangJsonFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!Array.isArray(parsed)) {
            reject(new Error('File must contain a JSON array of panchang entries'));
            return;
          }
          const invalid = parsed.some(ev => !ev || !ev.date || (!ev.tithi && !ev.nakshatra));
          if (invalid) {
            reject(new Error('Every entry needs a "date" and at least a "tithi" or "nakshatra"'));
            return;
          }
          const tagged = parsed.map(ev => ({
            type: 'panchang',
            date: ev.date,
            title: [ev.tithi, ev.nakshatra].filter(Boolean).join(' — '),
            tithi: ev.tithi || null,
            nakshatra: ev.nakshatra || null,
            moon_phase: ev.moonPhase || ev.moon_phase || null,
          }));
          resolve(tagged);
        } catch (err) {
          reject(new Error('That file is not valid JSON'));
        }
      };
      reader.onerror = () => reject(new Error('Could not read that file'));
      reader.readAsText(file);
    });
  }

  const handlePanchangFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setPanchangImportError('');
    setPanchangImportMsg('');
    setPanchangImporting(true);
    try {
      const tagged = await readPanchangJsonFile(file);
      setPanchangImportMsg(`Importing 0/${tagged.length}…`);
      const result = await importEvents(tagged, ({ done, total }) => setPanchangImportMsg(`Importing ${done}/${total}…`));
      if (result.success) {
        setPanchangImportMsg(`Added ${result.added}, skipped ${result.skipped} already on the calendar${result.rejected ? `, ${result.rejected} failed` : ''}.`);
      } else {
        setPanchangImportError('Import failed. Please try again.');
      }
    } catch (err) {
      setPanchangImportError(err.message || 'Import failed.');
    } finally {
      setPanchangImporting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const previousCategory = organization?.category || '';
    const payload = { ...formData };
    if (categoryUnlocked && adminCodeInput) {
      payload.admin_code = adminCodeInput;
    }
    const result = await updateOrganization(payload);

    if (result.success) {
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setCategoryUnlocked(false);
      setShowUnlockPrompt(false);
      setAdminCodeInput('');

      // Org type changed — offer to load that category's starter calendar
      // events. This only ever adds events; it never touches existing ones.
      if (formData.category && formData.category !== previousCategory) {
        const label = CATEGORY_TEMPLATE_LABELS[formData.category];
        const preview = CATEGORY_TEMPLATE_PREVIEW[formData.category];
        const confirmed = window.confirm(
          `Load default ${label} calendar events?\n\n${preview}\n\nThis adds these starter events to your calendar — it will not remove any existing events.`
        );
        if (confirmed) {
          const templateEvents = getTemplateEvents(formData.category);
          const importResult = await importEvents(templateEvents);
          if (importResult.success) {
            const skippedNote = importResult.skipped > 0
              ? ` (${importResult.skipped} already existed and ${importResult.skipped === 1 ? 'was' : 'were'} skipped)`
              : '';
            setSuccess(`Settings saved. Added ${importResult.added} starter ${label} event${importResult.added === 1 ? '' : 's'} to your calendar${skippedNote}.`);
          } else {
            setError('Settings saved, but adding starter events failed. You can try again by re-selecting the organization type.');
          }
        }
      }
    } else {
      setError(result.error || 'Failed to save settings');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen cf-settings-premium" style={HALO_BG}>
      <AdminToolbar activePage="settings" />
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
            <button
                onClick={() => { playClick(); navigate(-1); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-500">Manage your organization preferences</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 mt-5 border-b border-gray-200 overflow-x-auto">
            {SETTINGS_TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => { playClick(); setActiveTab(t.key); }}
                  className={`flex items-center gap-1.5 pb-3 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${activeTab === t.key ? 'text-gray-900 border-black' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
                >
                  <Icon className="w-4 h-4" /> {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
        {activeTab === 'organization' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)' }} className="w-10 h-10 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Organization</h2>
                <p className="text-sm text-gray-500">Basic information about your organization</p>
              </div>
            </div>
            <div className="space-y-4">
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                Organization Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="SV Temple Colorado"
                  required
              />
              <p className="mt-1 text-xs text-gray-400">Shown in the admin toolbar, public calendar heading, and footer</p>
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1 text-gray-700" />Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="1495 South Ridge Road, Castle Rock, CO 80104"
              />
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1 text-gray-700" />ZIP Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={formData.zip_code}
                onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="80104"
              />
              <p className="mt-1 text-xs text-gray-400">Used to recommend your organization to nearby visitors on the Explore page -- doesn't need to match your full address exactly.</p>
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1 text-gray-700" />Contact Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="303 660 9555"
              />
            </div>

            <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Organization Type
                  </label>
                  {Boolean(organization?.category) && !categoryUnlocked && (
                    <button
                      type="button"
                      onClick={() => { playClick(); setShowUnlockPrompt(v => !v); }}
                      className="text-xs font-semibold text-black hover:text-gray-700"
                    >
                      🔒 Locked — Unlock (admin)
                    </button>
                  )}
                </div>
                {showUnlockPrompt && !categoryUnlocked && (
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="password"
                      value={adminCodeInput}
                      onChange={(e) => setAdminCodeInput(e.target.value)}
                      placeholder="Admin code"
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    <button
                      type="button"
                      onClick={() => { playClick();
                        if (adminCodeInput) {
                          setCategoryUnlocked(true);
                          setShowUnlockPrompt(false);
                        }
                      }}
                      className="px-3 py-2 text-sm rounded-lg bg-black text-white font-semibold hover:bg-gray-800"
                    >
                      Unlock
                    </button>
                  </div>
                )}
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                disabled={Boolean(organization?.category) && !categoryUnlocked}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black bg-white disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">Not set</option>
                {ORG_CATEGORY_GROUPS.map((group) => (
                  <optgroup key={group.title} label={group.title}>
                    {group.keys.map((key) => (
                      <option key={key} value={key}>{ORG_CATEGORY_INFO[key].label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                {Boolean(organization?.category) && !categoryUnlocked
                  ? "Locked after it's first set, to keep your calendar templates consistent. Only the admin code can change it."
                  : 'Helps tailor the chatbot and flyer suggestions for your organization.'}
              </p>
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                Workspace URL
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                    value={formData.subdomain}
                    className="flex-1 px-4 py-3 rounded-l-lg border border-gray-300 bg-gray-50 text-gray-500"
                    readOnly
                />
                  <div className="px-4 py-3 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600">
                  .calendarflyapp.com
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Your public calendar: {formData.subdomain}.calendarflyapp.com
                </p>
              </div>
            </div>
        </div>
        )}
          {activeTab === 'branding' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Palette className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
                <p className="text-sm text-gray-500">Customize your calendar appearance</p>
              </div>
            </div>

            <div className="mb-6 pb-6 border-b border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Logo
              </label>
              <div className="flex items-center gap-4">
                {(logoPreview || organization?.logo_url) ? (
                  <img
                    src={logoPreview || organization.logo_url}
                    alt="Temple logo"
                    className="w-16 h-16 rounded-lg border border-gray-300 object-contain bg-white"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs text-center">
                    No logo yet
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleLogoFileChange}
                    className="hidden"
                    id="logo-upload-input"
                  />
                  <label
                    htmlFor="logo-upload-input"
                    className="inline-block px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
                  >
                    {logoUploading ? 'Uploading…' : 'Choose image'}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, SVG, or WebP. Square images work best.</p>
                  {logoError && <p className="text-xs text-red-600 mt-1">{logoError}</p>}
                </div>
              </div>
            </div>

            <div className="mb-6 pb-6 border-b border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Banner Image
              </label>
              <div className="flex items-center gap-4">
                {(bannerPreview || organization?.banner_url) ? (
                  <img
                    src={bannerPreview || organization.banner_url}
                    alt="Public calendar banner"
                    className="w-28 h-16 rounded-lg border border-gray-300 object-cover bg-white"
                  />
                ) : (
                  <div className="w-28 h-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs text-center">
                    No banner yet
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleBannerFileChange}
                    className="hidden"
                    id="banner-upload-input"
                  />
                  <label
                    htmlFor="banner-upload-input"
                    className="inline-block px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
                  >
                    {bannerUploading ? 'Uploading…' : 'Choose image'}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, or WebP. Wide images work best (shown on your public calendar page).</p>
                  {bannerError && <p className="text-xs text-red-600 mt-1">{bannerError}</p>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Primary Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-16 h-12 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="#f97316"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Secondary Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="w-16 h-12 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="#fff7ed"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700 mb-2">Preview:</p>

              <div className="flex gap-2">
                <div
                  style={{ backgroundColor: formData.primary_color }}
                  className="w-20 h-12 rounded-lg border border-gray-300"
                />
                <div
                  style={{ backgroundColor: formData.secondary_color }}
                  className="w-20 h-12 rounded-lg border border-gray-300"
                />
              </div>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Upload className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Import Events</h2>
                <p className="text-sm text-gray-500">Bulk-load events from a JSON file — events already on your calendar (same title + date) are skipped, never duplicated</p>
              </div>
            </div>

            <div className={organization?.category === 'temple' ? 'grid sm:grid-cols-2 gap-4' : ''}>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Events File</label>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleEventsFileChange}
                  className="hidden"
                  id="events-upload-input"
                />
                <label
                  htmlFor="events-upload-input"
                  className="inline-block px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
                >
                  {eventsImporting ? 'Importing…' : 'Choose JSON file'}
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  A JSON array like <code>[{'{'}"title": "Picnic", "date": "2026-07-11", "time": "11:00 AM"{'}'}]</code>
                </p>
                {eventsImportMsg && <p className="text-xs text-green-700 mt-1">{eventsImportMsg}</p>}
                {eventsImportError && <p className="text-xs text-red-600 mt-1">{eventsImportError}</p>}
              </div>

              {organization?.category === 'temple' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Panchang File</label>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={handlePanchangFileChange}
                    className="hidden"
                    id="panchang-upload-input"
                  />
                  <label
                    htmlFor="panchang-upload-input"
                    className="inline-block px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
                  >
                    {panchangImporting ? 'Importing…' : 'Choose JSON file'}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    A JSON array like <code>[{'{'}"date": "2026-08-20", "tithi": "Dasami 11:01 AM", "nakshatra": "Hasta 2:58 AM Wed"{'}'}]</code>
                  </p>
                  {panchangImportMsg && <p className="text-xs text-green-700 mt-1">{panchangImportMsg}</p>}
                  {panchangImportError && <p className="text-xs text-red-600 mt-1">{panchangImportError}</p>}
                </div>
              )}
            </div>
          </div>
          )}

          {activeTab === 'subscription' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-600" />
          </div>

            <div>
                <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
                <p className="text-sm text-gray-500">Your current plan and usage</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-sm text-black font-semibold">Current Plan</p>
                <p className="text-2xl font-bold text-black mt-1">
                  {organization?.plan || 'Free'}
                </p>
            </div>

              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-600 font-semibold">Events This Month</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {organization?.usage?.events_this_month ?? 0}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                <p className="text-sm text-purple-600 font-semibold">Team Members</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">
                  {organization?.team_members_used ?? 1}
                </p>
            </div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => { playClick(); navigate('/subscription'); }}
                className="text-black hover:text-gray-700 font-semibold text-sm"
              >
                Manage Subscription →
              </button>
              </div>
            </div>
          )}

          {activeTab === 'chatbot' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Bot className="w-5 h-5 text-gray-700" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sync Chatbot</h2>
                <p className="text-sm text-gray-500">Sync your event calendar to your WhatsApp assistant</p>
              </div>
            </div>
            {/* Shown directly in the tab — not a popup — per request. */}
            <SyncChatbotModal
              inline
              events={events}
              syncStatus={syncStatus}
              syncMessage={syncMessage}
              setSyncStatus={setSyncStatus}
              setSyncMessage={setSyncMessage}
            />
          </div>
          )}

          {activeTab === 'help' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-gray-700" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Help</h2>
                <p className="text-sm text-gray-500">Step-by-step guide for every feature</p>
              </div>
            </div>
            {/* Shown directly in the tab — not a popup — same as Sync Chatbot above. */}
            <HelpPage inline />
          </div>
          )}

          {/* Social Media Connections — highlighted: this is the one section
              that holds every Broadcast channel (Email, Facebook, Instagram,
              WhatsApp), so it gets a gold→pink accent rather than the plain
              white-card look the other sections share. */}
          {activeTab === 'social' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cf-settings-highlight">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Social Media Connections</h2>
                <p className="text-sm text-gray-500">Connect your own Facebook Page and Instagram so Broadcast posts go out from your accounts</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              <a
                href="https://claude.ai/code/artifact/08e7491f-95a3-458d-9308-1e79d226699a"
                target="_blank"
                rel="noreferrer"
                className="text-black font-semibold hover:underline"
              >
                Step-by-step setup guide →
              </a>
            </p>

            {socialMessage && (
              <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{socialMessage}</div>
            )}
            {socialError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{socialError}</div>
            )}

            <div className="space-y-4">
              {/* Email — not a "connect" flow like the others (no OAuth, no
                  Business Account), just the one address Broadcast's Email
                  option sends to. Moved in here so all four Broadcast
                  channels live in one section; still saved by the page's
                  own Save Settings button below, like Organization/Branding. */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 text-sm">Email List</h3>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${formData.broadcast_email ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {formData.broadcast_email ? 'Configured' : 'Not set'}
                  </span>
                </div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email List Address</label>
                <input
                  type="email"
                  value={formData.broadcast_email}
                  onChange={(e) => setFormData({ ...formData, broadcast_email: e.target.value })}
                  placeholder="announcements@yourtemple.org"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black text-sm"
                />
                <p className="text-xs text-gray-400 mt-2">One address Broadcast's Email option sends to — point it at your mailing list (a Google Group, Mailchimp-forwarding address, etc.) and your list handles the rest. Leave blank to keep Email off in Broadcast — saved with the Save Settings button below, not per-channel.</p>
              </div>

              <SocialConnectButtons />

              {/* WhatsApp — no manual-paste fallback: unlike Facebook/
                  Instagram, a WhatsApp number can't be identified by just an
                  ID a temple admin could copy from somewhere; Embedded
                  Signup is the only way this connects. Until it's configured
                  on the server, the shared .env WhatsApp number (set up
                  earlier this session) keeps working as the fallback. */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 text-sm">WhatsApp Business Number</h3>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${organization?.social_accounts?.whatsapp?.connected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {organization?.social_accounts?.whatsapp?.connected ? 'Connected' : 'Not connected'}
                  </span>
                </div>

                {!organization?.social_accounts?.whatsapp?.connected && (
                  <button
                    type="button"
                    onClick={() => { playClick(); handleConnectWhatsApp(); }}
                    disabled={waConnecting || !waConfig?.configured}
                    style={{ background: 'linear-gradient(135deg,#25d366,#128c3e)' }}
                    className="w-full px-4 py-2.5 rounded-lg text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {waConnecting ? 'Opening WhatsApp signup…' : '💬 Connect with WhatsApp'}
                  </button>
                )}
                {waConfig && !waConfig.configured && (
                  <p className="text-xs text-amber-600">One-click connect isn't set up on the server yet — broadcasts use the shared WhatsApp test number for now.</p>
                )}
                {organization?.social_accounts?.whatsapp?.connected && (
                  <>
                    <p className="text-xs text-gray-400">Sending as your own WhatsApp Business number instead of the shared test number.</p>
                    <button
                      type="button"
                      onClick={() => { playClick(); handleDisconnectSocial('whatsapp'); }}
                      className="mt-3 text-xs text-red-600 hover:text-red-700 font-semibold"
                    >
                      Disconnect WhatsApp
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>
          )}

          {/* Save Button — always visible so edits made on any tab (the
              form fields live in the shared formData/state above, not
              per-tab state) can be saved without switching tabs first. */}
          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => { playClick(); navigate(-1); }}
              className="px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)', boxShadow: '0 3px 10px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.16)' }}
              className="px-6 py-3 rounded-lg text-white font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
