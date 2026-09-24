/**
 * useTempleConfig — shared hook for temple identity fields.
 * Persists to localStorage so settings page and admin toolbar stay in sync.
 */
import { useState, useEffect, useCallback } from 'react';


const FALLBACK_DEFAULTS = {
  org_id: null,
  temple_name: 'Your Temple',
  category: null,
  address: '',
  phone: '',
  manager_phone: '',
  logo_url: '',
  banner_url: '',
  primary_color: '#f97316',
  secondary_color: '#fff7ed',
};

function authHeaders() {
  const token = localStorage.getItem('cf_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}
function orgQueryParam() {
  const params = new URLSearchParams(window.location.search);
  const org = params.get('org');
  return org ? `?org=${encodeURIComponent(org)}` : '';
}
function mapOrgToConfig(org) {
  return {
    org_id: org.org_id || null,
    temple_name: org.name || FALLBACK_DEFAULTS.temple_name,
    category: org.category || null,
    address: org.address || '',
    phone: org.phone || '',
    manager_phone: org.manager_phone || '',
    logo_url: org.logo_url || '',
    banner_url: org.banner_url || '',
    primary_color: org.primary_color || FALLBACK_DEFAULTS.primary_color,
    secondary_color: org.secondary_color || FALLBACK_DEFAULTS.secondary_color,
  };
}
export function useTempleConfig() {
  const [config, setConfig] = useState(FALLBACK_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/organizations/me' + orgQueryParam(), { headers: { ...authHeaders() } });
      if (res.ok) {
        const org = await res.json();
        setConfig(mapOrgToConfig(org));
      } else {
        setConfig(FALLBACK_DEFAULTS);
      }
    } catch {
      setConfig(FALLBACK_DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadConfig(); }, [loadConfig]);
  const updateConfig = useCallback(async (updates) => {
    setConfig(prev => ({ ...prev, ...updates }));
    const body = {};
    if (updates.temple_name !== undefined) body.name = updates.temple_name;
    if (updates.address !== undefined) body.address = updates.address;
    if (updates.phone !== undefined) body.phone = updates.phone;
    if (updates.manager_phone !== undefined) body.manager_phone = updates.manager_phone;
    if (updates.primary_color !== undefined) body.primary_color = updates.primary_color;
    if (updates.secondary_color !== undefined) body.secondary_color = updates.secondary_color;
    try {
      const res = await fetch('/api/organizations/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body)
  });
      if (!res.ok) {
        loadConfig();
      }
    } catch {
      loadConfig();
    }
  }, [loadConfig]);

  return { config, updateConfig, loading, DEFAULTS: FALLBACK_DEFAULTS };
}
