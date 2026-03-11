/**
 * PremiumLanding - Studio-quality landing page
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';

export default function PremiumLanding() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 transition-all duration-300"
        style={{
          background: scrollY > 50 ? 'rgba(10, 14, 39, 0.9)' : 'transparent',
          backdropFilter: scrollY > 50 ? 'blur(20px)' : 'none',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-xl">
              CF
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              CalendarFly
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="hover:text-purple-400 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-purple-400 transition-colors">Pricing</a>
            <button onClick={() => navigate('/login')} className="hover:text-purple-400 transition-colors">
              Login
            </button>
            <PremiumButton onClick={() => navigate('/signup')} size="sm">
              Start Free Trial
            </PremiumButton>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-96 h-96 bg-purple-500/30 rounded-full blur-3xl top-20 left-20 animate-pulse" />
          <div className="absolute w-96 h-96 bg-blue-500/30 rounded-full blur-3xl bottom-20 right-20 animate-pulse delay-1000" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <div className="inline-block mb-6 px-6 py-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20">
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent font-semibold">
              ✨ The Future of Temple Event Management
            </span>
          </div>

          <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
            Manage Your Temple
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              Like a Studio
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto">
            AI-powered event calendars, stunning flyer design, multi-platform broadcasting, and intelligent automation for temples and cultural centers.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <PremiumButton onClick={() => navigate('/signup')} size="lg" variant="gold">
              Start Free Trial →
            </PremiumButton>
            <PremiumButton onClick={() => navigate('/login')} size="lg" variant="secondary">
              Sign In
            </PremiumButton>
          </div>

          <p className="mt-6 text-gray-400">No credit card required • 7-day free trial</p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold mb-6">
              Everything You Need,
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Nothing You Don't
              </span>
            </h2>
            <p className="text-xl text-gray-400">Built for temples, designed like a studio</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '📅',
                title: 'Smart Calendar',
                description: 'Beautiful, responsive calendars with intelligent event management and automatic scheduling.',
                gradient: 'from-purple-500 to-pink-500',
              },
              {
                icon: '🎨',
                title: 'AI Flyer Studio',
                description: 'Generate stunning event flyers in seconds with DALL-E 3 integration and professional templates.',
                gradient: 'from-blue-500 to-cyan-500',
              },
              {
                icon: '📱',
                title: 'Omnichannel Broadcast',
                description: 'Send to WhatsApp, Facebook, Instagram with one click. Reach your community instantly.',
                gradient: 'from-emerald-500 to-green-500',
              },
              {
                icon: '🤖',
                title: 'AI Chatbot',
                description: '24/7 intelligent assistant answers questions about events, timings, and temple information.',
                gradient: 'from-orange-500 to-red-500',
              },
              {
                icon: '📊',
                title: 'Advanced Analytics',
                description: 'Track engagement, RSVPs, and community trends with real-time insights and reports.',
                gradient: 'from-violet-500 to-purple-500',
              },
              {
                icon: '⚡',
                title: 'Lightning Fast',
                description: 'Built on modern infrastructure. Sub-second load times, instant updates, zero lag.',
                gradient: 'from-yellow-500 to-amber-500',
              },
            ].map((feature, idx) => (
              <GlassCard key={idx} hover gradient className="p-8">
                <div className={`text-5xl mb-4 bg-gradient-to-r ${feature.gradient} bg-clip-text`}>
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-300 leading-relaxed">{feature.description}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 px-6 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold mb-6">
              Simple, Transparent
              <br />
              <span className="bg-gradient-to-r from-yellow-400 to-emerald-400 bg-clip-text text-transparent">
                Premium Pricing
              </span>
            </h2>
            <p className="text-xl text-gray-400">All plans include 7-day free trial</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                name: 'Starter',
                price: '$19',
                popular: false,
                features: ['Calendar + Flyer Editor', '50 events/month', 'WhatsApp/Facebook broadcast', 'AI Chatbot (500 msg/mo)', '3 users'],
              },
              {
                name: 'Pro',
                price: '$49',
                popular: true,
                features: ['Everything in Starter', 'Unlimited events', 'Advanced analytics', 'AI Chatbot (2000 msg/mo)', '10 users', 'Priority support'],
              },
              {
                name: 'Enterprise',
                price: '$149',
                popular: false,
                features: ['Everything in Pro', 'Unlimited everything', 'Custom domain', 'API access', 'White-label', 'Dedicated support'],
              },
              {
                name: 'Custom',
                price: 'Contact',
                popular: false,
                features: ['Custom integrations', 'On-premise deployment', 'SLA guarantee', 'Dedicated infrastructure', 'Training & onboarding'],
              },
            ].map((plan, idx) => (
              <GlassCard key={idx} hover gradient className={`p-8 ${plan.popular ? 'ring-2 ring-purple-500' : ''}`}>
                {plan.popular && (
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold py-1 px-4 rounded-full inline-block mb-4">
                    Most Popular
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.price !== 'Contact' && <span className="text-gray-400">/month</span>}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <PremiumButton 
                  fullWidth 
                  variant={plan.popular ? 'gold' : 'primary'}
                  onClick={() => navigate('/signup')}
                >
                  {plan.price === 'Contact' ? 'Contact Sales' : 'Start Free Trial'}
                </PremiumButton>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-bold mb-6">
            Ready to Transform
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Your Community?
            </span>
          </h2>
          <p className="text-xl text-gray-300 mb-12">
            Join hundreds of temples already using CalendarFly
          </p>
          <PremiumButton onClick={() => navigate('/signup')} size="lg" variant="gold">
            Start Your Free Trial →
          </PremiumButton>
          <p className="mt-6 text-gray-400">No credit card • Cancel anytime • Free forever plan available</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold">
                  CF
                </div>
                <span className="text-xl font-bold">CalendarFly</span>
              </div>
              <p className="text-gray-400">
                The future of temple event management
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="/signup" className="hover:text-white transition-colors">Sign Up</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 text-center text-gray-400">
            <p>© 2026 CalendarFly. Built with ❤️ by AI MITRA.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
