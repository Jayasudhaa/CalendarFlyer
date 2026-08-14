/**
 * HelpPage.jsx
 * Full help & instructions page for CalendarFly admin
 * Covers every feature with step-by-step guidance
 */
import React, { useState } from 'react';

const W  = 'var(--cf-text-primary)';
const G  = 'var(--cf-accent)';
const B  = 'var(--cf-border)';
const C  = 'var(--cf-bg-surface)';
const D  = 'var(--cf-bg-deep)';
const OR = 'var(--cf-accent)';

const SECTIONS = [
  {
    id: 'dashboard',
    icon: '📊',
    title: 'Dashboard',
    color: '#ea580c',
    steps: [
      { title: 'Open Dashboard', body: 'Click the 📊 Dashboard button in the top toolbar. It toggles a panel below the toolbar showing import/export tools and bulk actions.' },
      { title: 'Import Events (Panchang / JSON)', body: 'In the Dashboard panel, find the Import/Export tab. Upload a JSON file with your panchang or event data and click Import Events. Each event needs at minimum: title, date (YYYY-MM-DD).' },
      { title: 'Clear All Events', body: 'Use the Clear All button in Dashboard to wipe the calendar. This is permanent — export a backup JSON first if needed.' },
      { title: 'Export Events', body: 'Click Export JSON to download all current events as a backup file you can re-import later.' },
    ],
  },
  {
    id: 'events',
    icon: '📅',
    title: 'Adding & Editing Events',
    color: '#16a34a',
    steps: [
      { title: 'Add a New Event', body: 'Click the green + Add Event button (top-right toolbar). Fill in the title, date, time, description, and event type. Click Save.' },
      { title: 'Edit an Existing Event', body: 'On the calendar grid, click any event tile. An edit icon appears — click it to open the Edit Event modal. Change any fields and click Save.' },
      { title: 'Delete an Event', body: 'Open the Edit Event modal for the event, then click the Delete button at the bottom. Confirm the prompt.' },
      { title: 'Event Types', body: 'Use the type field to categorize: "pooja", "festival", "class", "community", or "panchang". Panchang events are filtered out of broadcasts and analytics.' },
      { title: 'RSVP Link', body: 'Each event automatically gets an RSVP URL at calendarflyapp.com/rsvp/<event-id>. Share this with devotees so they can register attendance.' },
    ],
  },
  {
    id: 'broadcast',
    icon: '📢',
    title: 'Broadcast',
    color: '#4f46e5',
    steps: [
      { title: 'Open Broadcast Studio', body: 'Click 📢 Broadcast in the top toolbar. The Broadcast Studio opens as a full-screen modal.' },
      { title: 'Select an Event', body: 'Choose the event you want to announce from the event dropdown at the top of the studio.' },
      { title: 'WhatsApp Broadcast', body: 'In the WhatsApp tab, compose your message. The event details auto-fill. Click Send to broadcast to your WhatsApp Business number. Recipients must have messaged your number first (Meta policy).' },
      { title: 'Facebook Broadcast', body: 'In the Facebook tab, write your post. Requires FB_PAGE_TOKEN and FB_PAGE_ID to be set in App Runner environment variables.' },
      { title: 'Instagram Broadcast', body: 'Requires IG_ACCOUNT_ID in environment variables. Compose caption and attach a flyer image.' },
      { title: 'RSVP Link in Broadcast', body: 'The RSVP link is auto-included in broadcast messages so devotees can register directly from WhatsApp or social media.' },
    ],
  },
  {
    id: 'flyer',
    icon: '🪔',
    title: 'Flyer Studio',
    color: '#7c3aed',
    steps: [
      { title: 'Open Flyer Studio', body: 'Click 🪔 Flyer Studio in the toolbar, OR click the flyer icon on any calendar event tile to pre-load that event\'s details.' },
      { title: 'Choose a Template', body: 'Select from the available premium templates — Gold Festival, Dark Diwali, Classic Saffron, etc. Each has a distinct style suited for different occasions.' },
      { title: 'Edit Text & Details', body: 'The event title, date, time, and description auto-populate from the selected event. You can override any field directly in the editor.' },
      { title: 'Add / Change Background Image', body: 'Click the image area to search Pixabay for a background, or upload your own. Use the opacity slider to control how much the image shows through.' },
      { title: 'Download Flyer', body: 'Click Download PNG to save the flyer to your computer. Use this image for WhatsApp, Instagram, or printing.' },
      { title: 'Send Directly to Broadcast', body: 'Click Send to Broadcast to hand off the flyer image straight into the Broadcast Studio without downloading first.' },
    ],
  },
  {
    id: 'analytics',
    icon: '📈',
    title: 'RSVP Analytics',
    color: '#0d9488',
    steps: [
      { title: 'Open Analytics', body: 'Click 📈 Analytics in the top toolbar. The RSVP Analytics panel opens showing all events with RSVP data.' },
      { title: 'View Guest Counts', body: 'Each event shows total RSVPs, confirmed guests, and a date-wise breakdown of when registrations came in.' },
      { title: 'Monthly View', body: 'Use the month sidebar to filter analytics by month. The main panel updates to show only that month\'s events.' },
      { title: 'Export Guest List', body: 'Click the CSV Export button on any event to download the full guest list with names, contact info, and RSVP date.' },
      { title: 'Share RSVP Link', body: 'Copy the RSVP link from the analytics panel and share it in broadcasts, WhatsApp groups, or the public calendar.' },
    ],
  },
  {
    id: 'publiccalendar',
    icon: '🌐',
    title: 'Public Calendar',
    color: '#0891b2',
    steps: [
      { title: 'View Public Calendar', body: 'Click 🌐 Public View in the toolbar. This opens calendarflyapp.com/calendar in a new tab — the shareable page devotees see.' },
      { title: 'Share the URL', body: 'The public URL is calendarflyapp.com/calendar. Add it to your temple website, WhatsApp group description, or social media bio.' },
      { title: 'What Devotees See', body: 'The public calendar shows all non-panchang events in a clean gold/cream theme with the temple name, address, and phone number. No admin controls are visible.' },
      { title: 'ChatBot Widget', body: 'The public calendar has a chat widget (bottom-right) powered by the WhatsApp RAG chatbot. Devotees can ask about timings, poojas, and temple info.' },
    ],
  },
  {
    id: 'settings',
    icon: '⚙️',
    title: 'Settings',
    color: '#8a7a6a',
    steps: [
      { title: 'Open Settings', body: 'Click ⚙️ Settings in the toolbar. You\'ll be taken to the Settings page.' },
      { title: 'Temple Profile', body: 'Update your temple name, address, phone number, and manager contact. These appear on the public calendar header and in broadcast messages.' },
      { title: 'Admin Password', body: 'Change the admin password that protects the /admin route. Set via VITE_ADMIN_PASSWORD environment variable.' },
      { title: 'WhatsApp Configuration', body: 'Set your WhatsApp Phone ID and token. These must also be set as environment variables in AWS App Runner for broadcasts to work.' },
      { title: 'Social Media Tokens', body: 'Add your Facebook Page Token, Page ID, and Instagram Account ID here to enable social broadcasts.' },
    ],
  },
  {
    id: 'assistant',
    icon: '🤖',
    title: 'AI Assistant',
    color: '#8B4513',
    steps: [
      { title: 'Open the Assistant', body: 'Click the 🤖 bubble in the bottom-right corner of any admin page. It\'s always visible.' },
      { title: 'Ask How-To Questions', body: 'Type any question like "how do I add an event?" or "how do I export a guest list?" and the assistant will explain in plain language.' },
      { title: 'Navigate by Voice Command', body: 'Type what you want to do: "open broadcast studio", "show me analytics", "create a flyer" — the assistant will open the right modal for you.' },
      { title: 'Check Upcoming Events', body: 'Ask "what events are coming up?" and the assistant will list the next 5 events from your calendar.' },
      { title: 'Use Quick Suggestions', body: 'When you first open the assistant, pill buttons appear with common actions. Click any to get instant help.' },
    ],
  },
  {
    id: 'troubleshoot',
    icon: '🔧',
    title: 'Troubleshooting',
    color: '#dc2626',
    steps: [
      { title: 'WhatsApp not sending', body: 'Check App Runner env vars: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID=830448146829881, TEST_MODE=true, TEST_RECIPIENT_NUMBER=17196391887. Also — the recipient must have messaged your business number first (Meta policy).' },
      { title: 'Events not showing on public calendar', body: 'Hard-refresh the public calendar (Ctrl+Shift+R). If still missing, check that the event date is correct and type is not "panchang".' },
      { title: 'RSVP analytics showing zero', body: 'RSVPs only appear after devotees use the RSVP link. Share the link in broadcasts. Check that the event key format is YYYY-MM-DD-title-slug.' },
      { title: 'Flyer download blank', body: 'Make sure a background image or color is selected. The canvas needs at least one visual element to render correctly.' },
      { title: 'AI assistant not responding', body: 'Check that ANTHROPIC_API_KEY is set in App Runner environment variables. Test with: fetch("/api/chat/admin-assistant", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({message:"hello",upcomingEvents:""})}).then(r=>r.json()).then(console.log)' },
      { title: 'Deployment rolled back', body: 'Go to App Runner → calendarfly → Logs → Service logs to find the error. Most common causes: missing env var, module not found, or port mismatch (PORT must be 5000).' },
    ],
  },
];

function StepCard({ step, index, accent }) {
  return (
    <div style={{
      display: 'flex', gap: 14, padding: '14px 0',
      borderBottom: `1px solid ${B}`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: accent + '22', border: `1.5px solid ${accent}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent, fontWeight: 800, fontSize: '0.78rem', marginTop: 1,
      }}>
        {index + 1}
      </div>
      <div>
        <div style={{ color: W, fontWeight: 700, fontSize: '0.88rem', marginBottom: 4 }}>
          {step.title}
        </div>
        <div style={{ color: '#a07850', fontSize: '0.82rem', lineHeight: 1.6 }}>
          {step.body}
        </div>
      </div>
    </div>
  );
}

function Section({ section, isOpen, onToggle }) {
  return (
    <div style={{
      background: C, border: `1px solid ${B}`, borderRadius: 14,
      overflow: 'hidden', marginBottom: 10,
    }}>
      {/* Section header */}
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 20px', background: 'transparent', border: 'none',
        cursor: 'pointer', textAlign: 'left',
      }}
        onMouseEnter={e => e.currentTarget.style.background = '#3d3530'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: section.color + '22', border: `1.5px solid ${section.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.2rem',
        }}>
          {section.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: W, fontWeight: 800, fontSize: '0.95rem' }}>{section.title}</div>
          <div style={{ color: '#7c5a3a', fontSize: '0.75rem', marginTop: 2 }}>
            {section.steps.length} steps
          </div>
        </div>
        <div style={{
          color: section.color, fontSize: '1.1rem',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.2s',
        }}>▾</div>
      </button>

      {/* Steps */}
      {isOpen && (
        <div style={{ padding: '0 20px 8px', borderTop: `1px solid ${B}` }}>
          {section.steps.map((step, i) => (
            <StepCard key={i} step={step} index={i} accent={section.color} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HelpPage({ onClose }) {
  const [openSection, setOpenSection] = useState('events');
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? SECTIONS.map(s => ({
        ...s,
        steps: s.steps.filter(st =>
          st.title.toLowerCase().includes(search.toLowerCase()) ||
          st.body.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(s => s.steps.length > 0)
    : SECTIONS;

  const toggle = (id) => setOpenSection(v => v === id ? null : id);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      fontFamily: 'Georgia, serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 720, background: D,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 0 80px rgba(0,0,0,0.7)',
      }}>

        {/* ── Header ── */}
        <div style={{
          background: 'linear-gradient(135deg,#8B4513,#c2410c)',
          padding: '20px 24px', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ fontSize: 28 }}>🛕</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
              CalendarFly Help Center
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginTop: 2 }}>
              Step-by-step guide for every feature
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
            fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* ── Search ── */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${B}`, flexShrink: 0 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍  Search help topics..."
            style={{
              width: '100%', padding: '10px 14px', boxSizing: 'border-box',
              background: C, border: `1px solid ${B}`, borderRadius: 10,
              color: W, fontSize: '0.88rem', outline: 'none',
              fontFamily: 'Georgia, serif',
            }}
            onFocus={e => e.target.style.borderColor = G}
            onBlur={e => e.target.style.borderColor = B}
          />
        </div>

        {/* ── Quick nav pills ── */}
        {!search && (
          <div style={{
            padding: '12px 24px', borderBottom: `1px solid ${B}`,
            display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0,
          }}>
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => { setOpenSection(s.id); document.getElementById(`help-${s.id}`)?.scrollIntoView({ behavior: 'smooth' }); }}
                style={{
                  padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                  border: `1px solid ${openSection === s.id ? s.color : B}`,
                  background: openSection === s.id ? s.color + '22' : C,
                  color: openSection === s.id ? s.color : '#7c5a3a',
                  fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Georgia, serif',
                  transition: 'all 0.15s',
                }}
              >
                {s.icon} {s.title}
              </button>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: '#7c5a3a', padding: '40px 0', fontSize: '0.9rem' }}>
              No results for "{search}"
            </div>
          )}
          {filtered.map(section => (
            <div key={section.id} id={`help-${section.id}`}>
              <Section
                section={section}
                isOpen={search ? true : openSection === section.id}
                onToggle={() => toggle(section.id)}
              />
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '14px 24px', borderTop: `1px solid ${B}`,
          background: C, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ color: '#7c5a3a', fontSize: '0.75rem' }}>
            🤖 Ask the AI assistant for instant help on any topic
          </div>
          <button onClick={onClose} style={{
            padding: '8px 20px', background: 'linear-gradient(135deg,#8B4513,#c2410c)',
            border: 'none', borderRadius: 8, color: '#fff',
            cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
            fontFamily: 'Georgia, serif',
          }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
