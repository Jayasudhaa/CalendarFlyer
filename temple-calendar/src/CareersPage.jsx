/**
 * CareersPage - dedicated /careers page. No open roles right now — honest
 * placeholder per the site owner's choice, with a way to reach out anyway.
 * Black & white — white background, black text — see PremiumLanding.jsx.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';
import MarketingNav from './components/MarketingNav';
import MarketingFooter from './components/MarketingFooter';

export default function CareersPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white text-black">
      <MarketingNav />

      <section className="pt-40 md:pt-48 pb-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Careers at CalendarFly
          </h1>

          <GlassCard light className="p-10 mt-10 text-left">
            <div className="text-4xl mb-4">🌱</div>
            <h2 className="text-2xl font-bold mb-3">We're not currently hiring</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              CalendarFly is a small, early-stage team right now, so we don't have any open roles listed. That said, we're growing — if you're excited about what we're building for small orgs, nonprofits, and cultural centers, we'd still like to hear from you.
            </p>
            <p className="text-gray-500 text-sm">
              Send us a note through the Contact page with a bit about yourself and what you're interested in. We'll keep it on file and reach out if something opens up that's a fit.
            </p>
          </GlassCard>

          <div className="mt-10">
            <PremiumButton onClick={() => navigate('/contact')} size="lg" variant="dark">Reach Out Anyway →</PremiumButton>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
