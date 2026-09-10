/**
 * FeaturesPage - dedicated /features page.
 * Expands on the teaser grid from the landing page's #features section with
 * more detail, grounded in what's actually built in the app (calendar sync,
 * bulk data import, RSVP, flyer studio, broadcast, multi-tenant admin, chatbot).
 * Black & white — white background, black text — see PremiumLanding.jsx.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';
import MarketingNav from './components/MarketingNav';
import MarketingFooter from './components/MarketingFooter';

const FEATURES = [
  {
    icon: '📅',
    title: 'Smart Calendar',
    description: 'A responsive admin + public calendar that stay in sync automatically. Add an event once and it shows up everywhere your community looks — no manual re-posting.',
    bullets: ['Monthly grid + mobile agenda view', 'Event types with color coding (Meeting, Fundraiser, Festival, Class...)', 'Duplicate-event detection on import'],
  },
  {
    icon: '🗓️',
    title: 'Bulk Calendar Import',
    description: 'Bulk-import recurring dates and details — holidays, meeting schedules, recurring programs — and they render right alongside your regular events, with a dedicated monthly view.',
    bullets: ['JSON bulk import with live progress', 'Custom badges on each day', 'Recurring-date indicators built in'],
  },
  {
    icon: '✅',
    title: 'RSVP Tracking',
    description: 'Every event gets a shareable RSVP link your community can use without creating an account. Responses roll up into a live dashboard.',
    bullets: ['Public, no-login RSVP pages per event', 'Response analytics dashboard', 'Add-to-Google-Calendar on every event'],
  },
  {
    icon: '🎨',
    title: 'AI Flyer Studio',
    description: 'Design event flyers directly from an event — pick a template, adjust text and branding, and export or send straight to broadcast.',
    bullets: ['Template-based flyer editor', 'Save drafts and revisit later', 'Direct-to-broadcast from the editor'],
  },
  {
    icon: '📱',
    title: 'Omnichannel Broadcast',
    description: 'Push announcements and flyers out to your community\'s channels from one place instead of posting to each platform by hand.',
    bullets: ['One panel for all your announcements', 'Pairs with the AI Flyer Studio', 'Built for small org & community broadcast workflows'],
  },
  {
    icon: '🤖',
    title: 'AI Chatbot',
    description: 'Sync your event calendar to a WhatsApp-based assistant so your community can ask "what\'s happening this week?" and get an answer instantly.',
    bullets: ['One-click calendar sync to chatbot', 'Answers timings, events, and organization info', 'No app download required for your community'],
  },
  {
    icon: '🏢',
    title: 'Multi-Tenant Admin',
    description: 'Built from the ground up so each organization gets its own subdomain, branding, and data — useful whether you run one location or several.',
    bullets: ['Per-org subdomain and branding', 'Role-based access (owner / admin / viewer)', 'Organization settings for address, phone, colors, logo'],
  },
  {
    icon: '📊',
    title: 'Dashboard & Advanced Analytics',
    description: 'A single admin dashboard for the whole operation — events, imports, RSVP trends, and account/subscription management in one place.',
    bullets: ['Bulk import/export tools', 'RSVP analytics', 'Account, profile and subscription pages'],
  },
];

export default function FeaturesPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white text-black">
      <MarketingNav />

      <section className="pt-40 md:pt-48 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Everything you need to run
            <br />
            your organization's calendar
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Calendar, bulk imports, RSVPs, flyers, broadcast and a chatbot — built specifically for small orgs, nonprofits, and community organizations, not adapted from a generic events tool.
          </p>
        </div>
      </section>

      <section className="pb-32 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8">
          {FEATURES.map((f, idx) => (
            <GlassCard key={idx} light hover className="p-8">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-2xl font-bold mb-3">{f.title}</h3>
              <p className="text-gray-600 leading-relaxed mb-4">{f.description}</p>
              <ul className="space-y-2">
                {f.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                    <span className="text-gray-400 mt-0.5">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="pb-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to see it on your own calendar?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <PremiumButton onClick={() => navigate('/signup')} size="lg" variant="dark">Start Free Today →</PremiumButton>
            <PremiumButton onClick={() => navigate('/pricing')} size="lg" variant="darkOutline">See Pricing</PremiumButton>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
