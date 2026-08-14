import React, { useState, useEffect } from 'react';

export default function OrgSettingsPage() {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    primary_color: '#ea580c',
    secondary_color: '#fff7ed'
  });

  const plans = {
    free: { name: 'Free Trial', price: '$0/mo', color: 'gray' },
    starter: { name: 'Starter', price: '$19/mo', color: 'blue' },
    pro: { name: 'Pro', price: '$49/mo', color: 'purple' },
    enterprise: { name: 'Enterprise', price: '$149/mo', color: 'orange' }
  };

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    try {
      const response = await fetch('/api/organizations/me');
      const data = await response.json();
      setOrg(data);
      setFormData({
        name: data.name,
        primary_color: data.primary_color,
        secondary_color: data.secondary_color
      });
    } catch (error) {
      console.error('Failed to fetch organization:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/organizations/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save');

      setMessage('✓ Settings saved successfully!');
      fetchOrganization();
    } catch (error) {
      setMessage('✗ Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePlan = async (newPlan) => {
    if (!confirm(`Change plan to ${plans[newPlan].name}?`)) return;

    try {
      const response = await fetch('/api/organizations/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan })
      });

      if (!response.ok) throw new Error('Failed to change plan');

      setMessage(`✓ Plan changed to ${plans[newPlan].name}!`);
      fetchOrganization();
    } catch (error) {
      setMessage('✗ Failed to change plan');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Organization Settings</h1>
          <p className="text-gray-600 mt-2">Manage your organization's profile and plan</p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.startsWith('✓') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message}
          </div>
        )}

        <div className="grid gap-6">
          {/* Organization Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Organization Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Organization Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Subdomain</label>
                <div className="flex items-center">
                  <span className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-l-lg text-gray-700">
                    {org.subdomain}
                  </span>
                  <span className="px-4 py-2 bg-gray-50 border border-l-0 border-gray-300 rounded-r-lg text-gray-600">
                    .calendarflyapp.com
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({...formData, primary_color: e.target.value})}
                      className="h-10 w-20 rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({...formData, primary_color: e.target.value})}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({...formData, secondary_color: e.target.value})}
                      className="h-10 w-20 rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({...formData, secondary_color: e.target.value})}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Current Plan */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Current Plan</h2>
            
            <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{plans[org.plan].name}</h3>
                <p className="text-2xl font-bold text-orange-600">{plans[org.plan].price}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Trial ends</p>
                <p className="text-sm font-semibold">{new Date(org.trial_ends_at).toLocaleDateString()}</p>
              </div>
            </div>

            <h3 className="font-semibold text-gray-900 mb-3">Usage This Month</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Events</p>
                <p className="text-2xl font-bold text-blue-600">
                  {org.usage.events_this_month}
                  {org.limits.events_per_month !== -1 && <span className="text-sm text-gray-600">/{org.limits.events_per_month}</span>}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-600">Flyers</p>
                <p className="text-2xl font-bold text-purple-600">
                  {org.usage.flyers_this_month}
                  {org.limits.flyers_per_month !== -1 && <span className="text-sm text-gray-600">/{org.limits.flyers_per_month}</span>}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">RSVPs</p>
                <p className="text-2xl font-bold text-green-600">
                  {org.usage.rsvp_responses_this_month}
                  {org.limits.rsvp_responses !== -1 && <span className="text-sm text-gray-600">/{org.limits.rsvp_responses}</span>}
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">Chatbot Messages</p>
                <p className="text-2xl font-bold text-orange-600">
                  {org.usage.chatbot_messages_this_month}
                  {org.limits.chatbot_messages !== -1 && <span className="text-sm text-gray-600">/{org.limits.chatbot_messages}</span>}
                </p>
              </div>
            </div>

            <h3 className="font-semibold text-gray-900 mb-3">Change Plan</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(plans).map(([key, plan]) => (
                <button
                  key={key}
                  onClick={() => handleChangePlan(key)}
                  disabled={org.plan === key}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    org.plan === key
                      ? 'border-orange-500 bg-orange-50 cursor-default'
                      : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold">{plan.name}</span>
                    {org.plan === key && <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded">Current</span>}
                  </div>
                  <p className="text-lg font-bold text-orange-600">{plan.price}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Enabled Features</h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(org.features).map(([feature, enabled]) => (
                <div key={feature} className={`p-3 rounded-lg ${enabled ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    {enabled ? (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className={`text-sm font-medium ${enabled ? 'text-green-900' : 'text-gray-500'}`}>
                      {feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
