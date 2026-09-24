/**
 * UsersAccessPanel.jsx
 * Platform-admin "Users & Access" tab — see every user across every
 * tenant, manually verify an account (unblocks testing/support when SES
 * isn't set up or a real email didn't land), suspend/reactivate a tenant,
 * and override individual feature flags per org regardless of plan.
 *
 * Same auth pattern as the rest of PlatformDashboard's tabs: the admin
 * code is passed down as a prop and sent as the x-admin-secret header on
 * every request — never stored anywhere persistent.
 */
import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldOff, Mail, Loader2, RefreshCw, ChevronDown, ChevronUp, Trash2, AlertTriangle } from 'lucide-react';

// Auth for platform-admin API calls: the manual ADMIN_SECRET code when one
// was typed in on the lock screen, otherwise this account's own login token
// (see PLATFORM_ADMIN_EMAILS / superAdminGuard in server/routes/admin.js) --
// so a super-admin who auto-unlocked via their regular login isn't stuck
// sending an empty x-admin-secret header that always 401s.
function adminAuthHeaders(adminCode) {
  if (adminCode) return { 'x-admin-secret': adminCode };
  const token = localStorage.getItem('cf_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}


const FEATURE_LABELS = {
  calendar: 'Calendar',
  flyer_editor: 'Flyer Editor',
  broadcast: 'Broadcast',
  rsvp: 'RSVP',
  chatbot: 'AI Chatbot',
  temple_library: 'Stock Library',
  analytics: 'Analytics',
  custom_domain: 'Custom Domain',
  api_access: 'API Access',
  white_label: 'White Label',
};

function fmtDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function UsersAccessPanel({ adminCode, organizations }) {
  const [users, setUsers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingUserId, setPendingUserId] = useState(null);

  const [orgs, setOrgs] = useState(organizations || []);
  const [orgError, setOrgError] = useState('');
  const [pendingOrgId, setPendingOrgId] = useState(null);
  const [expandedOrgId, setExpandedOrgId] = useState(null);
  const [deleteConfirmOrgId, setDeleteConfirmOrgId] = useState(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deletingOrgId, setDeletingOrgId] = useState(null);

  useEffect(() => { setOrgs(organizations || []); }, [organizations]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', { headers: adminAuthHeaders(adminCode) });
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data.users);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleVerify = async (userId) => {
    setPendingUserId(userId);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify`, {
        method: 'POST',
        headers: adminAuthHeaders(adminCode),
      });
      if (!res.ok) throw new Error('Failed to verify user');
      setUsers(prev => prev.map(u => (u.user_id === userId ? { ...u, email_verified: true } : u)));
    } catch (e) {
      setError(e.message);
    } finally {
      setPendingUserId(null);
    }
  };

  const handleSuspendToggle = async (org) => {
    setPendingOrgId(org.org_id);
    setOrgError('');
    try {
      const action = org.suspended ? 'reactivate' : 'suspend';
      const res = await fetch(`/api/admin/organizations/${org.org_id}/${action}`, {
        method: 'POST',
        headers: adminAuthHeaders(adminCode),
      });
      if (!res.ok) throw new Error(`Failed to ${action} organization`);
      setOrgs(prev => prev.map(o => (o.org_id === org.org_id ? { ...o, suspended: !org.suspended } : o)));
    } catch (e) {
      setOrgError(e.message);
    } finally {
      setPendingOrgId(null);
    }
  };

  const handleDeleteOrg = async (org) => {
    if (deleteConfirmInput !== org.subdomain) return;
    setDeletingOrgId(org.org_id);
    setOrgError('');
    try {
      const res = await fetch(`/api/admin/organizations/${org.org_id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders(adminCode) },
        body: JSON.stringify({ confirm_subdomain: deleteConfirmInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete organization');
      setOrgs(prev => prev.filter(o => o.org_id !== org.org_id));
      setUsers(prev => (prev ? prev.filter(u => u.org_id !== org.org_id) : prev));
      setDeleteConfirmOrgId(null);
      setDeleteConfirmInput('');
    } catch (e) {
      setOrgError(e.message);
    } finally {
      setDeletingOrgId(null);
    }
  };

  const handleFeatureChange = async (org, feature, value) => {
    setPendingOrgId(org.org_id);
    setOrgError('');
    try {
      const res = await fetch(`/api/admin/organizations/${org.org_id}/features`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders(adminCode) },
        body: JSON.stringify({ feature, enabled: value }),
      });
      if (!res.ok) throw new Error('Failed to update feature');
      const data = await res.json();
      setOrgs(prev => prev.map(o => (o.org_id === org.org_id ? { ...o, feature_overrides: data.organization.feature_overrides || {} } : o)));
    } catch (e) {
      setOrgError(e.message);
    } finally {
      setPendingOrgId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Users */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">All users</p>
            <p className="text-xs text-gray-400">Manually verify an account if the confirmation email never arrived</p>
          </div>
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {error && <div className="p-4 text-sm text-red-600 bg-red-50 border-b border-red-200">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-2 font-semibold">Email</th>
                <th className="text-left px-5 py-2 font-semibold">Organization</th>
                <th className="text-left px-5 py-2 font-semibold">Role</th>
                <th className="text-left px-5 py-2 font-semibold">Verified</th>
                <th className="text-left px-5 py-2 font-semibold">Last login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && !users && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading users…
                  </td>
                </tr>
              )}
              {users && users.map(u => (
                <tr key={u.user_id}>
                  <td className="px-5 py-3 text-gray-900 font-medium">{u.email}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {u.org_name}
                    {u.org_suspended && (
                      <span className="ml-2 text-[10px] font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded-full">Suspended</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600 capitalize">{u.role}</td>
                  <td className="px-5 py-3">
                    {u.email_verified ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                        <ShieldCheck className="w-3.5 h-3.5" /> Verified
                      </span>
                    ) : (
                      <button
                        onClick={() => handleVerify(u.user_id)}
                        disabled={pendingUserId === u.user_id}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 px-2.5 py-1 rounded-full"
                      >
                        <Mail className="w-3.5 h-3.5" /> {pendingUserId === u.user_id ? 'Verifying…' : 'Verify'}
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{fmtDate(u.last_login_at)}</td>
                </tr>
              ))}
              {users && users.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No users yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Org access control */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <p className="text-sm font-semibold text-gray-700">Organization access</p>
          <p className="text-xs text-gray-400">Suspend a tenant, or override a specific feature regardless of their plan</p>
        </div>
        {orgError && <div className="p-4 text-sm text-red-600 bg-red-50 border-b border-red-200">{orgError}</div>}
        <div className="divide-y divide-gray-100">
          {orgs.map(org => {
            const overrideCount = Object.keys(org.feature_overrides || {}).length;
            const isExpanded = expandedOrgId === org.org_id;
            return (
              <div key={org.org_id}>
                <div className="flex items-center justify-between px-5 py-3">
                  <button
                    onClick={() => setExpandedOrgId(isExpanded ? null : org.org_id)}
                    className="flex items-center gap-2 text-left flex-1 min-w-0"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{org.name}</p>
                      <p className="text-xs text-gray-400 capitalize">
                        {org.plan} plan{overrideCount > 0 && ` · ${overrideCount} override${overrideCount === 1 ? '' : 's'}`}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleSuspendToggle(org)}
                      disabled={pendingOrgId === org.org_id}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-50 ${
                        org.suspended ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                      }`}
                    >
                      {org.suspended ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                      {pendingOrgId === org.org_id ? 'Working…' : org.suspended ? 'Reactivate' : 'Suspend'}
                    </button>
                    <button
                      onClick={() => {
                        setDeleteConfirmOrgId(deleteConfirmOrgId === org.org_id ? null : org.org_id);
                        setDeleteConfirmInput('');
                      }}
                      title="Delete organization permanently"
                      className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {deleteConfirmOrgId === org.org_id && (
                  <div className="mx-5 mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
                    <div className="flex items-start gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-800 leading-relaxed">
                        This permanently deletes <strong>{org.name}</strong> — the organization, every user in it ({org.users_count}), and every event it owns ({org.events_count}). This cannot be undone. Type <code className="bg-red-100 px-1 rounded">{org.subdomain}</code> to confirm.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={deleteConfirmInput}
                        onChange={e => setDeleteConfirmInput(e.target.value)}
                        placeholder={org.subdomain}
                        className="flex-1 text-xs border border-red-300 rounded px-2 py-1.5 bg-white"
                      />
                      <button
                        onClick={() => handleDeleteOrg(org)}
                        disabled={deleteConfirmInput !== org.subdomain || deletingOrgId === org.org_id}
                        className="px-3 py-1.5 rounded text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {deletingOrgId === org.org_id ? 'Deleting…' : 'Permanently Delete'}
                      </button>
                      <button
                        onClick={() => { setDeleteConfirmOrgId(null); setDeleteConfirmInput(''); }}
                        className="px-3 py-1.5 rounded text-xs font-semibold text-gray-600 border border-gray-300 hover:bg-gray-50 whitespace-nowrap"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {isExpanded && (
                  <div className="px-5 pb-4 grid sm:grid-cols-2 gap-2">
                    {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                      const override = (org.feature_overrides || {})[key];
                      const value = override === true ? 'on' : override === false ? 'off' : 'default';
                      return (
                        <div key={key} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
                          <span className="text-xs font-medium text-gray-700">{label}</span>
                          <select
                            value={value}
                            disabled={pendingOrgId === org.org_id}
                            onChange={(e) => {
                              const v = e.target.value;
                              handleFeatureChange(org, key, v === 'default' ? null : v === 'on');
                            }}
                            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                          >
                            <option value="default">Plan default</option>
                            <option value="on">Force ON</option>
                            <option value="off">Force OFF</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {orgs.length === 0 && (
            <div className="px-5 py-8 text-center text-gray-400">No organizations yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
