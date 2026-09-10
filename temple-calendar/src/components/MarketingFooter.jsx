/**
 * MarketingFooter - shared footer for the public marketing site.
 * Denser, multi-column layout (Product / Company / Legal / Account) with a
 * bold statement banner on top — same shape as a typical B2B media-site
 * footer, sized to what CalendarFly actually has (no invented categories
 * or links to pages that don't exist). Black & white — see PremiumLanding.jsx.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import BrandMark from './BrandMark';
import PremiumButton from '../PremiumButton';

const LINK_COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', to: '/features' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Blog', to: '/blog' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Careers', to: '/careers' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
      { label: 'Security', to: '/security' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Sign Up', to: '/signup' },
      { label: 'Log In', to: '/login' },
    ],
  },
];

export default function MarketingFooter() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  const go = (path) => (e) => { e.preventDefault(); navigate(path); };

  return (
    <footer className="bg-black text-white border-t border-white/10">
      {/* Statement banner — cf-mkt-shine sweeps a soft light diagonal across
          the band, with a couple of twinkling sparkle dots (see index.css). */}
      <div className="cf-mkt-shine border-b border-white/10 px-6 py-16">
        <span className="cf-sparkle" style={{ width: 3, height: 3, top: '20%', left: '38%', animationDelay: '0.6s' }} aria-hidden="true" />
        <span className="cf-sparkle" style={{ width: 2, height: 2, top: '70%', left: '52%', animationDelay: '1.8s' }} aria-hidden="true" />
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight max-w-xl">
              Events simplified, Community amplified.
            </h2>
            <p className="text-gray-400 mt-3 max-w-md">
              Instant broadcasts and flyers built in minutes — so you spend less time on logistics and more time with your community.
            </p>
          </div>
          <PremiumButton onClick={() => navigate('/signup')} size="lg" variant="mono">
            Start Free Today →
          </PremiumButton>
        </div>
      </div>

      {/* Link columns */}
      <div className="px-6 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-6 gap-10">
            <div className="md:col-span-2">
              <button onClick={() => navigate('/')} className="flex items-center gap-3 mb-4">
                <BrandMark size={40} light />
                <span className="cf-shine-text text-xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>CalendarFly</span>
              </button>
              <p className="text-gray-400 max-w-xs">
                Calendar, flyers, and broadcast for community organizations — built like a studio, run by whoever has ten minutes.
              </p>
            </div>
            {LINK_COLUMNS.map((col) => (
              <div key={col.heading}>
                <h4 className="font-bold mb-4 text-sm uppercase tracking-wide text-gray-300">{col.heading}</h4>
                <ul className="space-y-2 text-gray-400">
                  {col.links.map((l) => (
                    <li key={l.to}>
                      <a href={l.to} onClick={go(l.to)} className="hover:text-white transition-colors">{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-gray-500 text-sm">
          <p>© {year} CalendarFly. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="/privacy" onClick={go('/privacy')} className="hover:text-white transition-colors">Privacy</a>
            <a href="/terms" onClick={go('/terms')} className="hover:text-white transition-colors">Terms</a>
            <a href="/security" onClick={go('/security')} className="hover:text-white transition-colors">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
