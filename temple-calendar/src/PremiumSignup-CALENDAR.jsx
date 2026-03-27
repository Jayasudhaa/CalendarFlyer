/**
 * PremiumSignup - Redirects to CALENDAR after signup
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';

const PLANS = {
  starter: { name: 'Starter', price: '$19', features: ['50 events/month', '3 users', 'AI Chatbot'] },
  pro: { name: 'Pro', price: '$49', features: ['Unlimited events', '10 users', 'Analytics'], popular: true },
  enterprise: { name: 'Enterprise', price: '$149', features: ['Everything', 'Custom domain', 'API access'] },
};

export default function PremiumSignup() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'name' && !formData.subdomain) {
      const subdomain = value.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
      setFormData(prev => ({ ...prev, subdomain }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signup({ ...formData, plan: selectedPlan });

    if (result.success) {
      navigate('/calendar'); // ← CHANGED from /dashboard to /calendar
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white px-6 py-12">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-purple-500/20 rounded-full blur-3xl top-20 left-20 animate-pulse" />
        <div className="absolute w-96 h-96 bg-blue-500/20 rounded-full blur-3xl bottom-20 right-20 animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-2xl">
              CF
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              CalendarFly
            </span>
          </div>
          <h1 className="text-5xl font-bold mb-4">
            {step === 1 ? 'Choose Your Plan' : 'Create Your Workspace'}
          </h1>
          <p className="text-xl text-gray-400">7-day free trial • No credit card required</p>
        </div>

        <div className="flex items-center justify-center gap-4 mb-12">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-purple-400' : 'text-gray-600'}`}>
            <div className={`w-8 h-8 rounded-full ${step >= 1 ? 'bg-purple-500' : 'bg-gray-700'} flex items-center justify-center font-bold`}>1</div>
            <span>Plan</span>
          </div>
          <div className={`h-0.5 w-12 ${step >= 2 ? 'bg-purple-500' : 'bg-gray-700'}`} />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-purple-400' : 'text-gray-600'}`}>
            <div className={`w-8 h-8 rounded-full ${step >= 2 ? 'bg-purple-500' : 'bg-gray-700'} flex items-center justify-center font-bold`}>2</div>
            <span>Details</span>
          </div>
        </div>

        {step === 1 && (
          <div>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {Object.entries(PLANS).map(([key, plan]) => (
                <GlassCard
                  key={key}
                  hover
                  gradient
                  className={`p-8 cursor-pointer ${selectedPlan === key ? 'ring-2 ring-purple-500' : ''}`}
                  onClick={() => setSelectedPlan(key)}
                >
                  {plan.popular && (
                    <div className="bg-gradient-to-r from-yellow-400 to-emerald-400 text-gray-900 text-sm font-bold py-1 px-4 rounded-full inline-block mb-4">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-400">/month</span>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="text-emerald-400">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {selectedPlan === key && (
                    <div className="bg-purple-500 text-white text-center py-2 rounded-lg font-bold">Selected ✓</div>
                  )}
                </GlassCard>
              ))}
            </div>
            <div className="text-center">
              <PremiumButton onClick={() => setStep(2)} size="lg" variant="gold">
                Continue with {PLANS[selectedPlan].name} →
              </PremiumButton>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-2xl mx-auto">
            <button onClick={() => setStep(1)} className="mb-6 text-purple-400 hover:text-purple-300">
              ← Back to plans
            </button>

            <GlassCard gradient className="p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Selected: {PLANS[selectedPlan].name}</h2>
                <p className="text-gray-400">{PLANS[selectedPlan].price}/month after 7-day free trial</p>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/50 text-red-300">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Organization Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="SV Temple Colorado"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Workspace URL *</label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      name="subdomain"
                      value={formData.subdomain}
                      onChange={handleInputChange}
                      placeholder="svtemple"
                      required
                      pattern="[a-z0-9]{3,20}"
                      className="flex-1 px-4 py-3 rounded-l-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <div className="px-4 py-3 bg-white/5 border border-l-0 border-white/10 rounded-r-xl text-gray-400">
                      .calendarflyapp.com
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-400">
                    Your workspace: {formData.subdomain || 'yourname'}.calendarflyapp.com
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="admin@temple.org"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Password *</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    required
                    minLength="8"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <PremiumButton type="submit" fullWidth size="lg" variant="gold" disabled={loading}>
                  {loading ? 'Creating workspace...' : 'Start Free Trial →'}
                </PremiumButton>

                <p className="text-center text-sm text-gray-400">
                  By signing up, you agree to our Terms & Privacy Policy
                </p>
              </form>
            </GlassCard>

            <div className="mt-6 text-center">
              <p className="text-gray-400">
                Already have an account?{' '}
                <button
                  onClick={() => navigate('/login')}
                  className="text-purple-400 hover:text-purple-300 font-semibold"
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
