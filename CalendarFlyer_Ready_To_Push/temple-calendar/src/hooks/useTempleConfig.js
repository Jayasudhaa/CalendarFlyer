/**
 * useTempleConfig — shared hook for temple identity fields.
 * Persists to localStorage so settings page and admin toolbar stay in sync.
 */
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'temple_config';

const DEFAULTS = {
  temple_name: 'Sample Temple Name',
  address: '123 Main Street, Your City, ST 00000',
  phone: '555 555 5555',
  manager_phone: '555 555 5556',
  primary_color: '#f97316',
  secondary_color: '#fff7ed',
};

export function useTempleConfig() {
  const [config, setConfig] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  });

  const updateConfig = (updates) => {
    const next = { ...config, ...updates };
    setConfig(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  return { config, updateConfig, DEFAULTS };
}
