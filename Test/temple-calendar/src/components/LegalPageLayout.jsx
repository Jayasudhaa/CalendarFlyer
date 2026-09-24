/**
 * LegalPageLayout - shared shell for Privacy / Terms / Security pages.
 * Keeps formatting consistent and carries a visible "this is a template"
 * disclaimer, since this content was AI-drafted and hasn't been reviewed
 * by a lawyer — that's the site owner's call to make before publishing.
 * Black & white — white background, black text — see PremiumLanding.jsx.
 */
import React from 'react';
import MarketingNav from './MarketingNav';
import MarketingFooter from './MarketingFooter';

export default function LegalPageLayout({ title, effectiveDate, hideDisclaimer, children }) {
  return (
    <div className="min-h-screen bg-white text-black">
      <MarketingNav />

      <section className="pt-36 md:pt-44 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">{title}</h1>
          <p className="text-gray-500 text-sm mb-8">Effective date: {effectiveDate}</p>

          {!hideDisclaimer && (
            <div className="mb-8 rounded-xl border border-yellow-300 bg-yellow-50 px-5 py-4 text-sm text-yellow-800 leading-relaxed">
              ⚠️ <strong>Template — not legal advice.</strong> This page was drafted as a starting point and hasn't been reviewed by a lawyer.
              Have it reviewed before relying on it or publishing it live.
            </div>
          )}

          <div className="space-y-8">
            {children}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

// Reusable "§ Heading + body copy" block so each legal page doesn't have to
// restate heading/paragraph classes for every section.
export function LegalSection({ title, children }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-black mb-3">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-3 text-sm">
        {children}
      </div>
    </div>
  );
}
