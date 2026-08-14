import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-6xl font-extrabold text-gray-900 mb-6">
              <span className="bg-gradient-to-r from-orange-600 to-orange-400 bg-clip-text text-transparent">
                CalendarFly
              </span>
            </h1>
            <p className="text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              The all-in-one platform for temples, cultural centers, and community organizations
            </p>
            <p className="text-xl text-gray-500 mb-12 max-w-2xl mx-auto">
              Create beautiful calendars, design stunning flyers, and engage your community — all in one place
            </p>
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate('/signup')}
                className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-8 py-4 rounded-lg font-bold text-lg hover:from-orange-700 hover:to-orange-600 transition-all shadow-lg transform hover:scale-105"
              >
                Start Free Trial →
              </button>
              <button
                onClick={() => navigate('/login')}
                className="bg-white text-orange-600 px-8 py-4 rounded-lg font-bold text-lg border-2 border-orange-600 hover:bg-orange-50 transition-all"
              >
                Sign In
              </button>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              No credit card required • 7-day free trial • Cancel anytime
            </p>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">Everything You Need</h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: '📅',
              title: 'Event Calendar',
              description: 'Beautiful, easy-to-use calendar for all your events. Add poojas, festivals, classes, and more.'
            },
            {
              icon: '🎨',
              title: 'Flyer Designer',
              description: 'Drag-and-drop editor with 500+ temple images. Create professional flyers in minutes.'
            },
            {
              icon: '📱',
              title: 'Multi-Platform Broadcast',
              description: 'Share to WhatsApp, Facebook, and Instagram with one click. Reach your entire community.'
            },
            {
              icon: '✅',
              title: 'RSVP Management',
              description: 'Track attendance, manage meal preferences, and send reminders automatically.'
            },
            {
              icon: '🤖',
              title: 'AI Chatbot',
              description: 'Answer community questions 24/7 with your own AI-powered chatbot.'
            },
            {
              icon: '📊',
              title: 'Analytics',
              description: 'Real-time insights on engagement, attendance, and community growth.'
            }
          ].map((feature, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow">
              <div className="text-5xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-gray-600 text-center mb-16">Choose the plan that fits your needs</p>
          
          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                name: 'Free Trial',
                price: '$0',
                period: '7 days',
                features: ['Calendar only', '10 events/month', '1 user', 'Basic support'],
                cta: 'Start Free',
                highlighted: false
              },
              {
                name: 'Starter',
                price: '$19',
                period: '/month',
                features: ['All features', '50 events/month', '3 users', 'Priority support'],
                cta: 'Get Started',
                highlighted: false
              },
              {
                name: 'Pro',
                price: '$49',
                period: '/month',
                features: ['Unlimited events', 'Analytics', '10 users', 'Premium support'],
                cta: 'Go Pro',
                highlighted: true
              },
              {
                name: 'Enterprise',
                price: '$149',
                period: '/month',
                features: ['Custom domain', 'API access', 'Unlimited users', 'White-label'],
                cta: 'Contact Us',
                highlighted: false
              }
            ].map((plan, i) => (
              <div
                key={i}
                className={`rounded-2xl p-8 ${
                  plan.highlighted
                    ? 'bg-gradient-to-br from-orange-600 to-orange-500 text-white shadow-2xl transform scale-105'
                    : 'bg-gray-50 text-gray-900'
                }`}
              >
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  <span className={plan.highlighted ? 'text-orange-100' : 'text-gray-500'}>
                    {plan.period}
                  </span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start">
                      <svg
                        className={`w-5 h-5 mr-2 mt-0.5 ${plan.highlighted ? 'text-orange-100' : 'text-orange-600'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/signup')}
                  className={`w-full py-3 rounded-lg font-bold transition-all ${
                    plan.highlighted
                      ? 'bg-white text-orange-600 hover:bg-gray-100'
                      : 'bg-orange-600 text-white hover:bg-orange-700'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-500 py-20">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-orange-100 mb-8">
            Join 100+ temples and cultural centers already using CalendarFly
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="bg-white text-orange-600 px-12 py-4 rounded-lg font-bold text-xl hover:bg-gray-100 transition-all shadow-lg transform hover:scale-105"
          >
            Start Your Free Trial →
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-400">© 2026 CalendarFly. Built with ❤️ for community organizations.</p>
        </div>
      </div>
    </div>
  );
}
