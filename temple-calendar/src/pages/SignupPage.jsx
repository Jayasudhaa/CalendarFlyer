import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SignupPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    email: '',
    plan: 'starter'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const plans = {
    free: {
      name: 'Free Trial',
      price: '$0',
      features: ['7-day trial', 'Calendar only', '10 events/month', '1 user']
    },
    starter: {
      name: 'Starter',
      price: '$19/mo',
      features: ['Everything in Free', 'Flyer Editor', 'Broadcast', 'RSVP', 'Chatbot', '50 events/month', '3 users']
    },
    pro: {
      name: 'Pro',
      price: '$49/mo',
      features: ['Everything in Starter', 'Unlimited events', 'Analytics Dashboard', '10 users']
    },
    enterprise: {
      name: 'Enterprise',
      price: '$149/mo',
      features: ['Everything in Pro', 'Custom domain', 'API access', 'White-label', 'Unlimited everything']
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/organizations/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      setSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'subdomain' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : value
    }));
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to CalendarFly! 🎉</h2>
            <p className="text-gray-600 mb-6">Your organization has been created successfully!</p>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-semibold text-gray-700 mb-2">Your Details:</p>
            <p className="text-sm text-gray-600"><span className="font-medium">Organization:</span> {success.organization.name}</p>
            <p className="text-sm text-gray-600"><span className="font-medium">Plan:</span> {plans[success.organization.plan].name}</p>
            <p className="text-sm text-gray-600 break-all"><span className="font-medium">Login URL:</span> {success.login_url}</p>
          </div>

          <a
            href={success.login_url}
            className="block w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white py-3 px-6 rounded-lg font-semibold hover:from-orange-700 hover:to-orange-600 transition-all shadow-lg"
          >
            Go to Your Calendar →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Start Your Free Trial</h1>
          <p className="text-xl text-gray-600">Create beautiful calendars and flyers for your organization</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Signup Form */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Your Organization</h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Organization Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="SV Temple Colorado"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Subdomain *
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    name="subdomain"
                    required
                    value={formData.subdomain}
                    onChange={handleChange}
                    placeholder="svtemple"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  <span className="bg-gray-100 px-4 py-3 border border-l-0 border-gray-300 rounded-r-lg text-gray-600">
                    .calendarflyapp.com
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Only lowercase letters and numbers</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="admin@temple.org"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Choose Your Plan
                </label>
                <div className="space-y-3">
                  {Object.entries(plans).map(([key, plan]) => (
                    <label
                      key={key}
                      className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.plan === key
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={key}
                        checked={formData.plan === key}
                        onChange={handleChange}
                        className="mt-1 text-orange-600 focus:ring-orange-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900">{plan.name}</span>
                          <span className="text-lg font-bold text-orange-600">{plan.price}</span>
                        </div>
                        <ul className="mt-2 text-xs text-gray-600 space-y-1">
                          {plan.features.slice(0, 3).map((feature, i) => (
                            <li key={i}>• {feature}</li>
                          ))}
                        </ul>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white py-4 px-6 rounded-lg font-bold text-lg hover:from-orange-700 hover:to-orange-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Start Free Trial →'}
              </button>

              <p className="text-xs text-center text-gray-500">
                No credit card required • 7-day free trial • Cancel anytime
              </p>
            </form>
          </div>

          {/* Features List */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">✨ What You Get</h3>
              <ul className="space-y-4">
                {[
                  '📅 Beautiful event calendars',
                  '🎨 Drag-and-drop flyer designer',
                  '📱 WhatsApp, Facebook & Instagram broadcast',
                  '✅ RSVP management & analytics',
                  '🤖 AI chatbot for your community',
                  '📊 Real-time analytics dashboard'
                ].map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-2xl mr-3">{feature.split(' ')[0]}</span>
                    <span className="text-gray-700 mt-1">{feature.split(' ').slice(1).join(' ')}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-2xl shadow-lg p-8 text-white">
              <h3 className="text-xl font-bold mb-4">🚀 Join 100+ Organizations</h3>
              <p className="mb-4">Temples, cultural centers, and community organizations trust CalendarFly to manage their events and engage their communities.</p>
              <p className="text-sm opacity-90">Start your free trial today. No credit card required!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
