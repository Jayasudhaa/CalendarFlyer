/**
 * PremiumSettings - Complete Settings Page
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ArrowLeft, Building2, Globe, Palette, CreditCard, Phone, MapPin, Save } from 'lucide-react';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';
import { useTempleConfig } from './hooks/useTempleConfig';


export default function PremiumSettings() {
  const navigate = useNavigate();
  const { user, organization, updateOrganization } = useAuth();
  const { config: templeConfig, updateConfig: updateTempleConfig } = useTempleConfig();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    primary_color: '#f97316',
    secondary_color: '#fff7ed',
  });
  // Temple identity fields (stored locally)
  const [templeData, setTempleData] = useState({
    temple_name: '',
    address: '',
    phone: '',
    manager_phone: '',
  });
  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        subdomain: organization.subdomain || '',
        primary_color: organization.primary_color || '#f97316',
        secondary_color: organization.secondary_color || '#fff7ed',
  });
    }
  }, [organization]);

  useEffect(() => {
    setTempleData({
      temple_name: templeConfig.temple_name || '',
      address: templeConfig.address || '',
      phone: templeConfig.phone || '',
      manager_phone: templeConfig.manager_phone || '',
    });
  }, [templeConfig]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    // Save temple identity fields locally
    updateTempleConfig(templeData);

    const result = await updateOrganization(formData);

    if (result.success) {
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(result.error || 'Failed to save settings');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
            <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-500">Manage your organization preferences</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Temple Identity ── */}
        <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg,#c2410c,#7c2d12)' }}>
              🕉️
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Temple Identity</h2>
              <p className="text-sm text-gray-500">Displayed in the admin toolbar, public calendar header, and footer</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Temple Name</label>
              <input
                type="text"
                value={templeData.temple_name}
                onChange={e => setTempleData({ ...templeData, temple_name: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-gray-900"
                placeholder="Sri Venkateswara Swamy Temple of Colorado"
              />
              <p className="mt-1 text-xs text-gray-400">Shown in the admin toolbar and public calendar heading</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-1 text-orange-500" />Address
              </label>
              <input
                type="text"
                value={templeData.address}
                onChange={e => setTempleData({ ...templeData, address: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="1495 South Ridge Road, Castle Rock, CO 80104"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1 text-orange-500" />Temple Phone
                </label>
                <input
                  type="tel"
                  value={templeData.phone}
                  onChange={e => setTempleData({ ...templeData, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="303 660 9555"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1 text-blue-500" />Manager Phone
                </label>
                <input
                  type="tel"
                  value={templeData.manager_phone}
                  onChange={e => setTempleData({ ...templeData, manager_phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="303 898 5514"
                />
              </div>
            </div>
            {/* Live preview */}
            <div className="mt-2 rounded-xl overflow-hidden border border-orange-200 shadow-sm">
              <div style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: 'linear-gradient(135deg,#c2410c,#7c2d12)', borderRadius: 8, padding: '5px 12px', color: '#fff', fontWeight: '900', fontSize: '0.8rem' }}>🕉️ Temple Admin</span>
                <span style={{ color: '#fff', fontWeight: '700', fontSize: '0.95rem', marginLeft: 8 }}>{templeData.temple_name || 'Temple Name'}</span>
              </div>
              <div style={{ background: '#162032', padding: '7px 16px', display: 'flex', gap: 20, fontSize: '0.78rem', flexWrap: 'wrap' }}>
                <span style={{ color: '#fb923c', fontWeight: '600' }}>📍 {templeData.address || 'Address'}</span>
                <span style={{ color: '#4ade80', fontWeight: '600' }}>📞 {templeData.phone || 'Phone'}</span>
                <span style={{ color: '#60a5fa', fontWeight: '600' }}>👤 Manager: {templeData.manager_phone || 'Manager Phone'}</span>
              </div>
            </div>
          </div>
        </div>
        {/* Organization Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Organization</h2>
                <p className="text-sm text-gray-500">Basic information about your organization</p>
              </div>
            </div>
            <div className="space-y-4">
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                Organization Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="SV Temple Colorado"
                  required
              />
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                Workspace URL
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                    value={formData.subdomain}
                    className="flex-1 px-4 py-3 rounded-l-lg border border-gray-300 bg-gray-50 text-gray-500"
                    readOnly
                />
                  <div className="px-4 py-3 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600">
                  .calendarflyapp.com
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Your public calendar: {formData.subdomain}.calendarflyapp.com
                </p>
              </div>
            </div>
          </div>
          {/* Branding */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Palette className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
                <p className="text-sm text-gray-500">Customize your calendar appearance</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Primary Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-16 h-12 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="#f97316"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Secondary Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="w-16 h-12 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="#fff7ed"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700 mb-2">Preview:</p>

              <div className="flex gap-2">
                <div
                  style={{ backgroundColor: formData.primary_color }}
                  className="w-20 h-12 rounded-lg border border-gray-300"
                />
                <div
                  style={{ backgroundColor: formData.secondary_color }}
                  className="w-20 h-12 rounded-lg border border-gray-300"
                />
              </div>
              </div>
            </div>

          {/* Subscription */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-600" />
          </div>

            <div>
                <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
                <p className="text-sm text-gray-500">Your current plan and usage</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                <p className="text-sm text-orange-600 font-semibold">Current Plan</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">
                  {organization?.plan || 'Free'}
                </p>
            </div>

              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-600 font-semibold">Events This Month</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {organization?.events_count || 0}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                <p className="text-sm text-purple-600 font-semibold">Team Members</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">
                  {organization?.users_count || 1}
                </p>
            </div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => alert('Upgrade feature coming soon!')}
                className="text-orange-600 hover:text-orange-700 font-semibold text-sm"
              >
                Upgrade Plan →
              </button>
              </div>
            </div>
          {/* Save Button */}
          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
