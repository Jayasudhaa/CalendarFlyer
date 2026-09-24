/**
 * server/utils/aiSettingsStore.js
 * Reads/writes the super-admin-editable AI image-generation settings
 * (system prompt, blocked terms, per-org-type prompt config) to a local
 * JSON file. Falls back to server/config/aiImageDefaults.js defaults when
 * no file exists yet or a field is missing.
 *
 * NOTE: this uses local disk, which is fine for a single-instance / EC2 /
 * on-prem deployment. If this app is ever moved to a stateless or
 * multi-instance host (e.g. multiple ECS tasks with no shared volume),
 * this should be swapped for a DynamoDB-backed store instead so settings
 * saved from the admin panel are visible to every instance.
 */
const fs = require('fs');
const path = require('path');
const { DEFAULT_AI_SETTINGS } = require('../config/aiImageDefaults');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'ai-image-settings.json');

// dance_school/music_school/yoga_school/restaurant/grocery get their own
// prompt config (distinct visual needs from a generic community flyer);
// every other org type (regional/language associations, mela/fair
// organizer, nonprofit, plain community org, other) shares 'community'
// -- see resolveCategory() in routes/generate-image.js.
const KNOWN_CATEGORIES = ['temple', 'community', 'dance_school', 'music_school', 'yoga_school', 'restaurant', 'grocery'];

function mergeWithDefaults(saved) {
  saved = saved && typeof saved === 'object' ? saved : {};
  const categories = {};
  for (const key of KNOWN_CATEGORIES) {
    categories[key] = {
      ...DEFAULT_AI_SETTINGS.categories[key],
      ...((saved.categories && saved.categories[key]) || {}),
    };
  }
  return {
    systemPrompt: typeof saved.systemPrompt === 'string' ? saved.systemPrompt : DEFAULT_AI_SETTINGS.systemPrompt,
    blockedTerms: Array.isArray(saved.blockedTerms) ? saved.blockedTerms : DEFAULT_AI_SETTINGS.blockedTerms,
    categories,
    updatedAt: saved.updatedAt || null,
  };
}

function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return mergeWithDefaults(JSON.parse(raw));
    }
  } catch (err) {
    console.error('[aiSettingsStore] Failed to read settings file, using defaults:', err.message);
  }
  return mergeWithDefaults(null);
}

function saveSettings(partial) {
  partial = partial || {};
  const current = getSettings();

  const next = {
    systemPrompt: partial.systemPrompt !== undefined ? partial.systemPrompt : current.systemPrompt,
    blockedTerms: partial.blockedTerms !== undefined ? partial.blockedTerms : current.blockedTerms,
    categories: { ...current.categories },
    updatedAt: Date.now(),
  };

  if (partial.categories && typeof partial.categories === 'object') {
    for (const key of KNOWN_CATEGORIES) {
      if (partial.categories[key]) {
        next.categories[key] = { ...current.categories[key], ...partial.categories[key] };
      }
    }
  }

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.error('[aiSettingsStore] Failed to save settings file:', err.message);
    throw err;
  }

  return next;
}

module.exports = { getSettings, saveSettings, KNOWN_CATEGORIES };
