/**
 * src/pages/TeamManagementPage.jsx
 * Per-organization team management — Owner / Admin / Viewer.
 *
 * This is the UI half of the role system introduced alongside
 * server/middleware/roles.js: before this page existed, the only way to add
 * a teammate was POST /api/auth/create-guest called by hand (there was no
 * per-org "who has access" screen at all — UsersAccessPanel.jsx is a
 * PLATFORM-level, cross-tenant tool, not this).
 *
 * Everyone signed in can see this page (knowing who's on your own team is
 * harmless for a Viewer); only Owner/Admin can invite, change a role, or
 * remove someone — enforced both here (buttons disabled) and, the part that
 * actually matters, server-side by requireRole('owner','admin') on the
 * mutating routes.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, UserCog, Crown, Shield, Eye, UserPlus, Trash2, X } from 'lucide-react';
import AdminToolbar from '../components/AdminToolbar';

const HALO_BG = { backgroundColor: 'var(--cf-bg-base)' };

const ROLE_META = {
  owner:  { label: 'Owner',  icon: Crown, badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  admin:  { label: 'Admin',  icon: Shield, badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  viewer: { label: 'Viewer', icon: Eye,   badgeClass: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function RoleBadge({ role }) {
  const meta = ROLE_META[role] || ROLE_META.viewer;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.badgeClass}`}>
      <Icon className="w-3.5 h-3.5" />
      {meta.label}
    </span>
  );
}

function authHeaders() {
  const token = localStorage.getItem('cf_token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export default function TeamManagementPage() {
  const navigate = useNavigate();
  const { user, canManage } = useAuth();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyUserId, setBusyUserId] = useState(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', displayName: '', password: '', role: 'viewer' });
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [invitedCreds, setInvitedCreds] = useState(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/organizations/team', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load team');
      setMembers(data.members || []);
    } catch (err) {
      setError(err.message || 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  async function handleRoleChange(member, newRole) {
    setBusyUserId(member.user_id);
    setError('');
    try {
      const res = await fetch(`/api/organizations/team/${member.user_id}/role`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role');
      setMembers(prev => prev.map(m => (m.user_id === member.user_id ? { ...m, role: newRole } : m)));
      setSuccess(`${member.display_name || member.email}'s role is now ${ROLE_META[newRole].label}.`);
    } catch (err) {
      setError(err.message || 'Failed to update role');
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleRemove(member) {
    if (!window.confirm(`Remove ${member.display_name || member.email} from your team? They'll lose access immediately.`)) {
      return;
    }
    setBusyUserId(member.user_id);
    setError('');
    try {
      const res = await fetch(`/api/organizations/team/${member.user_id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove team member');
      setMembers(prev => prev.filter(m => m.user_id !== member.user_id));
      setSuccess(`${member.display_name || member.email} has been removed.`);
    } catch (err) {
      setError(err.message || 'Failed to remove team member');
    } finally {
      setBusyUserId(null);
    }
  }

  function generatePassword() {
    // Simple, readable-ish random password — good enough for an invite the
    // recipient is expected to change on first login (no "change password
    // on first login" flow exists yet, so this is just a starting point).
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pw = '';
    for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setInviteForm(f => ({ ...f, password: pw }));
  }

  async function handleInvite(e) {
    e.preventDefault();
    setInviteError('');
    if (!inviteForm.email.trim() || !inviteForm.password) {
      setInviteError('Email and password are required.');
      return;
    }
    setInviting(true);
    try {
      const res = await fetch('/api/auth/create-guest', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          email: inviteForm.email.trim(),
          password: inviteForm.password,
          displayName: inviteForm.displayName.trim(),
          role: inviteForm.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invite team member');
      setInvitedCreds({ email: inviteForm.email.trim(), password: inviteForm.password, role: inviteForm.role });
      setInviteForm({ email: '', displayName: '', password: '', role: 'viewer' });
      await loadTeam();
    } catch (err) {
      setInviteError(err.message || 'Failed to invite team member');
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="min-h-screen" style={HALO_BG}>
      <AdminToolbar activePage="team" />

      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <UserCog className="w-6 h-6 text-gray-700" /> Team
                </h1>
                <p className="text-sm text-gray-500">Who has access to your organization, and what they can do</p>
              </div>
            </div>
            {canManage && (
              <button
                onClick={() => { setShowInvite(true); setInvitedCreds(null); setInviteError(''); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors"
              >
                <UserPlus className="w-4 h-4" /> Invite teammate
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 flex items-center justify-between">
            {success}
            <button onClick={() => setSuccess('')} className="text-green-700/70 hover:text-green-900"><X className="w-4 h-4" /></button>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center justify-between">
            {error}
            <button onClick={() => setError('')} className="text-red-700/70 hover:text-red-900"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Role explainer */}
        <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-600">
          <span className="font-semibold text-gray-800">Owner</span> manages billing and can delete the organization.{' '}
          <span className="font-semibold text-gray-800">Admin</span> can do everything else — events, flyers, broadcasts, settings, and inviting people.{' '}
          <span className="font-semibold text-gray-800">Viewer</span> can see the calendar, events, and RSVP/analytics numbers, but can't create or send anything.
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading team…</div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No team members found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-6 py-3 font-medium">Member</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => {
                  const isSelf = m.user_id === user?.user_id;
                  const rowBusy = busyUserId === m.user_id;
                  const canEditThisRow = canManage && !m.isOwner;
                  return (
                    <tr key={m.user_id} className="border-b border-gray-100 last:border-0">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{m.display_name || m.email}{isSelf ? ' (you)' : ''}</div>
                        <div className="text-gray-500">{m.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <RoleBadge role={m.isOwner ? 'owner' : m.role} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {canEditThisRow && (
                            <select
                              value={m.role === 'owner' ? 'admin' : m.role}
                              disabled={rowBusy}
                              onChange={(e) => handleRoleChange(m, e.target.value)}
                              className="text-xs border border-gray-300 rounded-md px-2 py-1.5 disabled:opacity-50"
                            >
                              <option value="admin">Admin</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          )}
                          {canEditThisRow && !isSelf && (
                            <button
                              onClick={() => handleRemove(m)}
                              disabled={rowBusy}
                              title="Remove from team"
                              className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[200] p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            {invitedCreds ? (
              <>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Teammate added</h2>
                <p className="text-sm text-gray-600 mb-4">Share these sign-in details with them directly — they won't be shown again here.</p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm space-y-1 mb-4">
                  <div><span className="text-gray-500">Email:</span> <span className="font-mono">{invitedCreds.email}</span></div>
                  <div><span className="text-gray-500">Password:</span> <span className="font-mono">{invitedCreds.password}</span></div>
                  <div><span className="text-gray-500">Role:</span> {ROLE_META[invitedCreds.role].label}</div>
                </div>
                <button onClick={() => { setShowInvite(false); setInvitedCreds(null); }} className="w-full py-2.5 rounded-lg bg-gray-900 text-white font-semibold hover:bg-black">
                  Done
                </button>
              </>
            ) : (
              <form onSubmit={handleInvite}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Invite a teammate</h2>
                  <button type="button" onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
                </div>
                {inviteError && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{inviteError}</div>}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Name (optional)</label>
                    <input
                      type="text"
                      value={inviteForm.displayName}
                      onChange={(e) => setInviteForm(f => ({ ...f, displayName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                    <select
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm(f => ({ ...f, role: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      <option value="viewer">Viewer — can view only</option>
                      <option value="admin">Admin — can manage everything except billing</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Temporary password</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={inviteForm.password}
                        onChange={(e) => setInviteForm(f => ({ ...f, password: e.target.value }))}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 font-mono focus:outline-none focus:ring-2 focus:ring-black"
                      />
                      <button type="button" onClick={generatePassword} className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                        Generate
                      </button>
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={inviting} className="mt-6 w-full py-2.5 rounded-lg bg-gray-900 text-white font-semibold hover:bg-black disabled:opacity-50">
                  {inviting ? 'Adding…' : 'Add teammate'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
