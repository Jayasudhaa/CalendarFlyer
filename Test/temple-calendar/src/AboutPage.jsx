/**
 * AboutPage - dedicated /about page.
 * Black & white — white background, black text — see PremiumLanding.jsx.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';
import MarketingNav from './components/MarketingNav';
import MarketingFooter from './components/MarketingFooter';

export default function AboutPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white text-black">
      <MarketingNav />

      <section className="pt-40 md:pt-48 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            About CalendarFly
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            CalendarFly exists because small organizations, nonprofits, and cultural centers deserve software built for how they actually run — not a generic events tool with a coat of paint.
          </p>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto flex flex-col gap-10">
          <GlassCard light className="relative overflow-hidden border-2 border-gray-200 hover:border-black transition-colors duration-300 shadow-sm">
            <div className="absolute top-0 left-0 h-full w-1.5 bg-black" />
            <div className="p-8 md:p-10">
              <div className="flex items-start gap-4 mb-5">
                <span
                  className="text-6xl font-black leading-none text-black/10 select-none"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  aria-hidden="true"
                >01</span>
                <div className="pt-2">
                  <div className="text-xs font-semibold tracking-[0.2em] text-gray-400 uppercase mb-1">Mission</div>
                  <h2 className="text-3xl font-bold">Our Mission</h2>
                </div>
              </div>
              <p className="text-gray-700 leading-relaxed mb-4 text-lg italic">
                "The volunteer who keeps the Sunday schedule straight deserves software as good as what a Fortune 500 marketing team gets."
              </p>
              <p className="text-gray-600 leading-relaxed mb-4">
                That's the simple, stubborn belief CalendarFly started with — not a leftover spreadsheet, a Facebook event nobody checks, or an enterprise platform priced for a sales team's budget.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Small organizations are where community actually happens — the harvest festival, the sign-up sheet, the reminder that keeps a hundred families in sync — and they're almost always run by someone doing it on top of a full-time job, for free, because they care. Our mission is to give every one of those admins their evenings back: one calendar that's genuinely theirs, RSVPs that don't live across six text threads, and a way to reach the community in two clicks instead of two hours. When the busywork disappears, what's left is more time for the community itself — which was the whole point all along.
              </p>
            </div>
          </GlassCard>

          <GlassCard light className="relative overflow-hidden border-2 border-gray-200 hover:border-black transition-colors duration-300 shadow-sm">
            <div className="absolute top-0 left-0 h-full w-1.5 bg-black" />
            <div className="p-8 md:p-10">
              <div className="flex items-start gap-4 mb-5">
                <span
                  className="text-6xl font-black leading-none text-black/10 select-none"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  aria-hidden="true"
                >02</span>
                <div className="pt-2">
                  <div className="text-xs font-semibold tracking-[0.2em] text-gray-400 uppercase mb-1">Origin story</div>
                  <h2 className="text-3xl font-bold">How We Got Here</h2>
                </div>
              </div>
              <p className="text-gray-700 leading-relaxed mb-4 text-lg italic">
                A printed calendar taped to a wall. A spreadsheet three volunteers were editing at once. RSVPs tracked by counting reply-all emails.
              </p>
              <p className="text-gray-600 leading-relaxed mb-4">
                This didn't start as a business plan — it started by sitting with real community-org admins and watching what their week actually looked like.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Every part of CalendarFly exists because someone specifically needed it, not because a roadmap said so — a public calendar so families stop calling to ask "what time is it again?", a broadcast tool so one announcement reaches every channel without retyping it three times, an RSVP tracker so a volunteer coordinator isn't guessing how many chairs to set out. We built it one real conversation at a time, with the people who'd actually use it on a Tuesday night after their day job — and kept only the parts that genuinely saved them time. That's still how it gets built today.
              </p>
            </div>
          </GlassCard>
        </div>
      </section>

      <section className="pb-32 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">What we care about</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <GlassCard light className="p-6 text-center">
              <div className="text-3xl mb-3">📆</div>
              <div className="font-bold mb-2">Built for community orgs</div>
              <div className="text-gray-500 text-sm">Event types and calendar tools that actually match how small orgs, nonprofits, and cultural centers schedule things.</div>
            </GlassCard>
            <GlassCard light className="p-6 text-center">
              <div className="text-3xl mb-3">🤝</div>
              <div className="font-bold mb-2">Easy for volunteers</div>
              <div className="text-gray-500 text-sm">Admin tools simple enough that whoever's running events this month can pick it up quickly.</div>
            </GlassCard>
            <GlassCard light className="p-6 text-center">
              <div className="text-3xl mb-3">🔒</div>
              <div className="font-bold mb-2">Your data, your org</div>
              <div className="text-gray-500 text-sm">Each organization's calendar, branding and settings are kept separate on their own subdomain.</div>
            </GlassCard>
          </div>
        </div>
      </section>

      <section className="pb-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Have questions about CalendarFly?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <PremiumButton onClick={() => navigate('/contact')} size="lg" variant="dark">Get in Touch</PremiumButton>
            <PremiumButton onClick={() => navigate('/signup')} size="lg" variant="darkOutline">Start Free Today</PremiumButton>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
