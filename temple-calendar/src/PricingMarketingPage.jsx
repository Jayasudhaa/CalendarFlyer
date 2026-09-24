/**
 * PricingMarketingPage - dedicated /pricing page for logged-out visitors.
 * (Named "Marketing" to avoid clashing with SubscriptionPage.jsx, which is
 * the logged-in "change my org's plan" page — this one is the public,
 * pre-signup pricing page.) Plan tiers/prices mirror SubscriptionPage.jsx
 * and server/organizations.js's PLAN_FEATURES / PLAN_LIMITS so the numbers
 * stay consistent whether you're logged in or not. Black & white — white
 * background, black text — see PremiumLanding.jsx.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';
import MarketingNav from './components/MarketingNav';
import MarketingFooter from './components/MarketingFooter';

// Individuals: free consumer plan for anyone browsing Explore -- not an
// org tier, so it's shown as its own callout rather than a grid card (see
// render below), with its own CTA into the Explore feed instead of /signup.
const INDIVIDUAL_PLAN = {
  name: 'Individuals',
  price: 'Free',
  description: 'Event and organization search, follow organizations, save events, and add events to a personal calendar.',
};

// Enterprise is no longer a self-serve card (pricing update, Sept 2026) --
// its distinguishing features either moved down into Free/Pro below, or
// live on behind the "Need something custom?" Contact Sales banner instead
// of a fixed $149 price tag. The 'enterprise' plan itself still exists
// server-side (PLAN_FEATURES/PLAN_LIMITS in organizations.js) for whenever
// a custom deal actually gets negotiated -- see SubscriptionPage.jsx.
const PLANS = [
  {
    name: 'Organization Free',
    price: '$0',
    popular: false,
    features: ['Public organization page & calendar', 'Instagram + Facebook broadcast', 'WhatsApp broadcast (requires a WhatsApp Business number)', 'Event creation — 30 events/month', 'Basic announcements'],
  },
  {
    name: 'Organization Plus',
    price: '$49',
    popular: false,
    features: ['Everything in Organization Free', 'AI Flyer Studio — 30 AI image generations/month', 'Flyer templates', 'Scheduled announcements', '50 events/month'],
  },
  {
    name: 'Organization Pro',
    price: '$79',
    popular: true,
    features: ['Everything in Organization Plus', 'Unlimited events', 'AI-powered analytics', 'AI-powered search and summary — upload files, get summaries & action items', 'Searchable media gallery', 'AI Chatbot (2000 msg/mo)', 'More team & admin tools', 'Priority support', '75 AI image generations/month'],
  },
];

const FAQS = [
  { q: 'Is there a free trial?', a: 'Yes — every paid plan starts with a 7-day free trial, no credit card required.' },
  { q: 'Can I change plans later?', a: 'Yes, you can switch plans any time from your account\'s Subscription page.' },
  { q: 'What happens if I go over my event limit?', a: 'We\'ll let you know — you can upgrade any time to raise your limits.' },
  { q: 'Do you offer custom/on-premise deployments?', a: 'Yes, reach out via our Contact page and we\'ll talk through what you need.' },
];

export default function PricingMarketingPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white text-black">
      <MarketingNav />

      <section className="pt-40 md:pt-48 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Simple, Transparent
            <br />
            Pricing
          </h1>
          <p className="text-xl text-gray-500">Start free with Calendar + Facebook &amp; Instagram broadcast. No credit card required.</p>
        </div>
      </section>

      <section className="pb-4 px-6">
        <div className="max-w-4xl mx-auto">
          <GlassCard light className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-bold text-lg">{INDIVIDUAL_PLAN.name} — {INDIVIDUAL_PLAN.price}, always</div>
              <div className="text-gray-500 text-sm mt-1">{INDIVIDUAL_PLAN.description}</div>
            </div>
            <PremiumButton variant="darkOutline" onClick={() => navigate('/explore')}>Start exploring</PremiumButton>
          </GlassCard>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-7xl mx-auto mb-6 text-center">
          <h2 className="text-2xl font-bold">For organizations</h2>
        </div>
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {PLANS.map((plan, idx) => (
            <GlassCard key={idx} light hover className={`p-8 ${plan.popular ? 'ring-2 ring-black' : ''}`}>
              {plan.popular && (
                <div className="bg-black text-white text-sm font-bold py-1 px-4 rounded-full inline-block mb-4">
                  Most Popular
                </div>
              )}
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">✓</span>
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>
              <PremiumButton fullWidth variant={plan.popular ? 'dark' : 'darkOutline'} onClick={() => navigate('/signup')}>
                {plan.name === 'Organization Free' ? 'Get Started' : 'Start Free Trial'}
              </PremiumButton>
            </GlassCard>
          ))}
        </div>
        <div className="max-w-7xl mx-auto mt-6">
          <GlassCard light className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-bold text-lg">Need something custom?</div>
              <div className="text-gray-500 text-sm">Custom domain, API access, white-label, unlimited storage, dedicated support, on-premise deployment, SLAs, dedicated infrastructure, training and onboarding.</div>
              <div className="text-gray-500 text-sm mt-1">Or email us directly: <a href="mailto:support@calendarflyapp.com" className="text-black underline">support@calendarflyapp.com</a></div>
            </div>
            <PremiumButton variant="darkOutline" onClick={() => navigate('/contact')}>Contact Sales</PremiumButton>
          </GlassCard>
        </div>
      </section>

      <section className="pb-32 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-10 text-center">Frequently asked questions</h2>
          <div className="space-y-4">
            {FAQS.map((f, i) => (
              <GlassCard key={i} light className="p-6">
                <div className="font-bold mb-2">{f.q}</div>
                <div className="text-gray-500 text-sm leading-relaxed">{f.a}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
