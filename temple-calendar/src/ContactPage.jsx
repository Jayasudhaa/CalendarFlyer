/**
 * ContactPage - dedicated /contact page with a real form.
 * Submits to POST /api/contact, which sends an email via AWS SES
 * (see server/routes/contact.js) — no database storage, per the site
 * owner's choice to have submissions delivered straight to their inbox.
 * Black & white — white background, black text — see PremiumLanding.jsx.
 */
import React, { useState } from 'react';
import PremiumButton from './PremiumButton';
import MarketingNav from './components/MarketingNav';
import MarketingFooter from './components/MarketingFooter';

const TOPICS = ['General question', 'Sales', 'Support', 'Partnership', 'Careers'];

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', topic: TOPICS[0], message: '' });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok: bool, message: string }

  const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult(null);
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setResult({ ok: false, message: 'Please fill in your name, email, and message.' });
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');
      setResult({ ok: true, message: "Thanks — your message is on its way. We'll get back to you soon." });
      setForm({ name: '', email: '', topic: TOPICS[0], message: '' });
    } catch (err) {
      setResult({ ok: false, message: err.message || 'Something went wrong sending your message. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <MarketingNav />

      <section className="pt-40 md:pt-48 pb-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h1 className="text-5xl font-bold mb-4">
              Get in Touch
            </h1>
            <p className="text-gray-600">Questions about CalendarFly, pricing, or your organization's setup? Send us a note.</p>
          </div>

          {/* Boxed as one shared panel — a single 2px black border framing
              both the photo and the form, rather than two separately
              bordered pieces (see PremiumLogin.jsx for the same treatment
              on the sign-in card). */}
          <div className="rounded-3xl border-2 border-black bg-white shadow-md p-6 md:p-10">
            <div className="grid md:grid-cols-2 gap-10 items-start">
              <div className="hidden md:block sticky top-32">
                <div className="rounded-2xl overflow-hidden aspect-[2/1]">
                  <img
                    src="/marketing/contact-workspace.jpg"
                    alt="A laptop and phone showing CalendarFly's calendar and chat, connected to icons representing the community it reaches"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="mt-4 text-sm text-gray-500 max-w-sm">
                  One dashboard, connected to your whole community — reach out and tell us about yours.
                </p>
              </div>

              <div>
                {result && (
                  // Monochrome by design (see MarketingNav/Footer, PremiumLanding, etc.) —
                  // success/error is told apart by weight and an icon, not color.
                  <div className={`mb-6 rounded-lg px-4 py-3 text-sm text-black ${result.ok ? 'bg-gray-50 border border-gray-300' : 'bg-gray-50 border-2 border-black font-semibold'}`}>
                    {result.ok ? '✓ ' : '✕ '}{result.message}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                      <input
                        type="text" value={form.name} onChange={update('name')}
                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 text-black placeholder-gray-400 transition-colors hover:border-gray-400 focus:outline-none focus:border-black focus:ring-2 focus:ring-black"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                      <input
                        type="email" value={form.email} onChange={update('email')}
                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 text-black placeholder-gray-400 transition-colors hover:border-gray-400 focus:outline-none focus:border-black focus:ring-2 focus:ring-black"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Topic</label>
                    <select
                      value={form.topic} onChange={update('topic')}
                      className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 text-black transition-colors hover:border-gray-400 focus:outline-none focus:border-black focus:ring-2 focus:ring-black"
                    >
                      {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Message</label>
                    <textarea
                      value={form.message} onChange={update('message')}
                      rows={5}
                      className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 text-black placeholder-gray-400 transition-colors hover:border-gray-400 focus:outline-none focus:border-black focus:ring-2 focus:ring-black resize-none"
                      placeholder="How can we help?"
                    />
                  </div>
                  <PremiumButton type="submit" fullWidth variant="dark" disabled={sending}>
                    {sending ? 'Sending…' : 'Send Message'}
                  </PremiumButton>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
