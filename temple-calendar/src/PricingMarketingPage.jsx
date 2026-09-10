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

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    popular: false,
    features: ['Calendar', 'Instagram + Facebook broadcast', '30 events/month — create & broadcast'],
  },
  {
    name: 'Starter',
    price: '$49',
    popular: false,
    features: ['Everything in Free', 'AI Flyer Studio (30 AI images/mo)', '50 events/month'],
  },
  {
    name: 'Pro',
    price: '$99',
    popular: true,
    features: ['Everything in Starter', 'Unlimited events', 'Advanced analytics', 'AI Chatbot (2000 msg/mo)', 'Priority support'],
  },
  {
    name: 'Enterprise',
    price: '$149',
    popular: false,
    features: ['Everything in Pro', 'WhatsApp broadcast (requires a WhatsApp Business number)', 'Unlimited everything', 'Custom domain', 'AI document search — upload files, get summaries & action items', 'Public chatbot for your community', 'Live photo sharing (public)', 'Public messages (multi-channel)', 'Dedicated support'],
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

      <section className="pb-24 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-6">
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
                {plan.name === 'Free' ? 'Get Started' : 'Start Free Trial'}
              </PremiumButton>
            </GlassCard>
          ))}
        </div>
        <div className="max-w-7xl mx-auto mt-6">
          <GlassCard light className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-bold text-lg">Need something custom?</div>
              <div className="text-gray-500 text-sm">On-premise deployment, SLAs, dedicated infrastructure, training and onboarding.</div>
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
