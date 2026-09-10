/**
 * StockLibraryGenerator.jsx
 * Super-admin-only tool that generates a stock image (using the same
 * guardrails/style as the temple category in Flyer Studio's AI Gen tab)
 * and saves it straight into the shared curated S3 library that every
 * org's Flyer Studio "Library" tab reads from (server/routes/imageLibrary.js).
 *
 * Talks to POST /api/admin/library-image, guarded server-side by the same
 * superAdminGuard used everywhere else on this page — normal org admins
 * never see this tool or get to write into the shared library.
 */
import React, { useState } from 'react';
import { ImagePlus, Loader2, CheckCircle2 } from 'lucide-react';

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


const CATEGORIES = ['Deities', 'Festivals', 'Flowers', 'Rangoli', 'General', 'States'];

// A curated starter set — click one to load it into the prompt box, then
// tweak it if you like before generating. Covers the categories the S3
// library is organized into (see imageLibrary.js's CATEGORY_MAP).
const PRESETS = [
  { category: 'Deities',   prompt: 'Lord Venkateswara (Balaji) temple deity idol, ornately decorated with garlands and gold jewelry, dimly lit sanctum with diya lamps' },
  { category: 'Deities',   prompt: 'Goddess Lakshmi seated on a lotus, golden coins, soft divine glow, traditional South Indian temple art style' },
  { category: 'Deities',   prompt: 'Lord Ganesha idol adorned with fresh flower garlands and modak offerings, festive decoration' },
  { category: 'Deities',   prompt: 'Goddess Durga idol on festive pandal decoration, vibrant colors, traditional dress' },
  { category: 'Deities',   prompt: 'Lord Krishna with flute, peacock feather crown, soft blue divine glow, traditional temple art' },
  { category: 'Festivals', prompt: 'Diwali celebration, rows of glowing diya oil lamps, marigold flowers, warm golden light' },
  { category: 'Festivals', prompt: 'Navratri Garba dance celebration, colorful traditional attire, festive decorations, dandiya sticks' },
  { category: 'Festivals', prompt: 'Ganesh Chaturthi festival pandal, decorated with flowers and lights, festive atmosphere' },
  { category: 'Festivals', prompt: 'Pongal harvest festival, traditional clay pot, sugarcane, sunflowers, South Indian festive decor' },
  { category: 'Flowers',   prompt: 'Fresh marigold flower garland close-up, vibrant orange and yellow, traditional temple decoration' },
  { category: 'Flowers',   prompt: 'Jasmine and rose flower arrangement for temple pooja offering, close-up macro shot' },
  { category: 'Rangoli',   prompt: 'Colorful traditional rangoli pattern on temple floor, geometric floral design, vibrant powder colors' },
  { category: 'Rangoli',   prompt: 'Rangoli design surrounded by glowing diya lamps for Diwali, intricate mandala pattern' },
  { category: 'General',   prompt: 'South Indian temple gopuram tower silhouette at golden hour sunset, dramatic sky' },
  { category: 'General',   prompt: 'Festive string lights and bunting decoration for community celebration, warm bokeh background' },
  // One iconic-landmark prompt per Indian state -- a one-time curation
  // pass so every org's Flyer Studio Library gets a "States" category to
  // pull region-specific imagery from, instead of generating it themselves.
  { category: 'States',     prompt: 'Tirumala Venkateswara Temple hill and gopuram at golden hour, Tirupati, Andhra Pradesh' },
  { category: 'States',     prompt: 'Tawang Monastery in the Himalayas, prayer flags fluttering, misty mountain backdrop, Arunachal Pradesh' },
  { category: 'States',     prompt: 'Kamakhya Temple on Nilachal Hill overlooking the Brahmaputra river, Assam' },
  { category: 'States',     prompt: 'Mahabodhi Temple and ancient stupa beside the sacred Bodhi tree, Bodh Gaya, Bihar' },
  { category: 'States',     prompt: 'Chitrakote Waterfalls cascading through lush green forest, dramatic mist, Chhattisgarh' },
  { category: 'States',     prompt: 'Basilica of Bom Jesus with colonial Portuguese architecture, palm trees, Goa' },
  { category: 'States',     prompt: 'Statue of Unity rising above the Narmada river valley, dramatic sky, Gujarat' },
  { category: 'States',     prompt: 'Brahma Sarovar sacred lake with stone ghats at sunrise, Kurukshetra, Haryana' },
  { category: 'States',     prompt: 'Snow-capped Himalayan peaks above a pine forest valley, Manali, Himachal Pradesh' },
  { category: 'States',     prompt: 'Baidyanath Jyotirlinga Temple spire with traditional architecture, Deoghar, Jharkhand' },
  { category: 'States',     prompt: 'Mysore Palace illuminated at dusk, ornate domes, royal Indo-Saracenic architecture, Karnataka' },
  { category: 'States',     prompt: 'Kerala backwaters with a traditional houseboat gliding past palm-lined canals at sunset' },
  { category: 'States',     prompt: 'Khajuraho temple complex with intricate stone carvings glowing in golden hour light, Madhya Pradesh' },
  { category: 'States',     prompt: 'Gateway of India monument against the Arabian Sea, Mumbai, Maharashtra' },
  { category: 'States',     prompt: 'Loktak Lake with floating phumdis and misty hills at dawn, Manipur' },
  { category: 'States',     prompt: 'Living root bridge over a stream in a lush rainforest, Meghalaya' },
  { category: 'States',     prompt: 'Rolling green hills with a traditional bamboo village in misty valley light, Mizoram' },
  { category: 'States',     prompt: 'Hornbill festival dancers in traditional tribal attire with colorful feathered headgear, Nagaland' },
  { category: 'States',     prompt: 'Jagannath Temple towers with the traditional chariot festival procession, Puri, Odisha' },
  { category: 'States',     prompt: 'Golden Temple glowing at dawn, reflecting in the surrounding sacred pool, Amritsar, Punjab' },
  { category: 'States',     prompt: 'Hawa Mahal pink sandstone facade against a warm desert sky, Jaipur, Rajasthan' },
  { category: 'States',     prompt: 'Rumtek Monastery with prayer flags against a Himalayan backdrop, Sikkim' },
  { category: 'States',     prompt: 'Meenakshi Amman Temple gopuram with ornate colorful sculptures, Madurai, Tamil Nadu' },
  { category: 'States',     prompt: 'Charminar monument illuminated at dusk, Hyderabad, Telangana' },
  { category: 'States',     prompt: 'Neermahal water palace reflecting on the lake, traditional architecture, Tripura' },
  { category: 'States',     prompt: 'Taj Mahal at sunrise, white marble Mughal architecture reflecting in the pool, Agra, Uttar Pradesh' },
  { category: 'States',     prompt: 'Har Ki Pauri ghat with a glowing Ganga aarti ceremony at dusk, Haridwar, Uttarakhand' },
  { category: 'States',     prompt: 'Victoria Memorial marble dome and colonial architecture at golden hour, Kolkata, West Bengal' },
];

export default function StockLibraryGenerator({ adminCode }) {
  const [category, setCategory] = useState('Deities');
  const [prompt, setPrompt]     = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError]       = useState('');
  const [saved, setSaved]       = useState([]); // { url, key, category, prompt }

  const usePreset = (p) => { setCategory(p.category); setPrompt(p.prompt); };

  const generate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/admin/library-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders(adminCode) },
        body: JSON.stringify({ prompt: prompt.trim(), category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setSaved(s => [{ ...data, prompt: prompt.trim() }, ...s]);
    } catch (err) {
      setError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
        <ImagePlus className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-orange-900">
          <p className="font-semibold mb-1">Builds the shared stock library</p>
          <p className="text-orange-800">
            Every image generated here is saved to <code>temple-images/library/&lt;category&gt;/</code> in S3 and
            immediately shows up in the "📚 Library" tab of Flyer Studio for every organization — a one-time
            curation step rather than something each org has to generate themselves.
          </p>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Quick prompts — click to load, then generate</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => usePreset(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                prompt === p.prompt ? 'bg-orange-600 text-white border-orange-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {p.prompt.split(',')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <label className="block text-xs font-semibold text-gray-600 mb-1">S3 category folder</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full px-3 py-2 mb-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Prompt</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={3}
          placeholder="Describe the deity, festival, flower, rangoli, or background scene…"
          className="w-full px-3 py-2 mb-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />

        <button
          onClick={generate}
          disabled={generating || !prompt.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          {generating ? 'Generating & saving…' : '✨ Generate & Add to Library'}
        </button>
      </div>

      {saved.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">Added this session</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {saved.map((img, i) => (
              <div key={i} className="rounded-lg overflow-hidden border border-gray-200">
                <img src={img.url} alt={img.prompt} className="w-full aspect-square object-cover" />
                <div className="p-1.5">
                  <div className="flex items-center gap-1 text-[10px] text-green-700 font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> {img.category}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-900 mb-2">Prefer to upload real photos instead?</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Upload .jpg/.jpeg/.png/.webp files directly into your S3 bucket under
          <code className="mx-1 px-1 py-0.5 bg-gray-100 rounded">temple-images/library/&lt;Category&gt;/</code>
          — use exactly one of <strong>Deities</strong>, <strong>Festivals</strong>, <strong>Flowers</strong>,{' '}
          <strong>Rangoli</strong>, or <strong>General</strong> as the folder name (case-sensitive) so it's filed
          under the matching tab. They'll appear in Flyer Studio's Library tab automatically — no restart needed.
        </p>
      </div>
    </div>
  );
}
