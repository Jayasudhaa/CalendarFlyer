/**
 * MarketingNav - shared top header for the public marketing site
 * (Landing, Features, Pricing, Blog, About, Contact, Careers, Privacy,
 * Terms, Security). Extracted from PremiumLanding.jsx so every page gets
 * the same header and the same working links instead of duplicating this
 * markup everywhere.
 *
 * Two-row header (thin utility bar + main nav), both black — a deliberate
 * dark bookend around the white page body, same idea as MarketingFooter.jsx
 * staying black. Still strictly monochrome, no color accents.
 *
 * Because this header is taller than a single-row nav, every page using it
 * needs a bit more top padding on its first section — see the `md:pt-*`
 * bump alongside each page's base `pt-*` class.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PremiumButton from '../PremiumButton';
import BrandMark from './BrandMark';

export default function MarketingNav() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed top-0 w-full z-50">
      {/* Utility bar — Contact Sales lives only in the pricing/enterprise
          sections now (PremiumLanding.jsx's pricing section,
          PricingMarketingPage.jsx's enterprise callout), not on every page,
          so it doesn't compete with the actual page CTAs. */}
      <div className="hidden md:block border-b border-white/10 bg-black">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-end gap-4 text-xs text-white/60">
          <a href="mailto:support@calendarflyapp.com" className="hover:text-white transition-colors">
            support@calendarflyapp.com
          </a>
        </div>
      </div>

      {/* Main nav — cf-mkt-shine adds a slow diagonal light sweep across the
          bar (see index.css); a few .cf-sparkle dots twinkle near the CTA. */}
      <nav
        className="cf-mkt-shine transition-all duration-300 border-b border-white/10"
        style={{
          background: scrollY > 50 ? 'rgba(0, 0, 0, 0.97)' : 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <span className="cf-sparkle" style={{ width: 3, height: 3, top: '30%', right: '18%', animationDelay: '0.4s' }} aria-hidden="true" />
        <span className="cf-sparkle" style={{ width: 2, height: 2, top: '65%', right: '30%', animationDelay: '1.3s' }} aria-hidden="true" />
        <span className="cf-sparkle" style={{ width: 2, height: 2, top: '25%', right: '45%', animationDelay: '2.1s' }} aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-3">
            <BrandMark size={56} light />
            <span className="flex flex-col items-start leading-none">
              <span
                className="cf-shine-text text-4xl font-extrabold"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                CalendarFly
              </span>
              <span className="hidden sm:block text-xs tracking-wide text-white font-bold mt-1">
                Events simplified, Community amplified
              </span>
            </span>
          </button>

          <div className="hidden md:flex items-center gap-8">
            {/* cf-shine-text gives each link the same shimmering-white
                treatment as the wordmark; staggered animationDelay values
                (inline style beats the class's shorthand, same trick as the
                sparkle dots above) make the shimmer cascade left to right
                instead of all six links flashing in lockstep. */}
            <button onClick={() => navigate('/features')} className="cf-shine-text text-base font-bold hover:opacity-80 transition-opacity" style={{ animationDelay: '0s' }}>Features</button>
            <button onClick={() => navigate('/pricing')} className="cf-shine-text text-base font-bold hover:opacity-80 transition-opacity" style={{ animationDelay: '0.3s' }}>Pricing</button>
            <button onClick={() => navigate('/blog')} className="cf-shine-text text-base font-bold hover:opacity-80 transition-opacity" style={{ animationDelay: '0.6s' }}>Blog</button>
            <button onClick={() => navigate('/about')} className="cf-shine-text text-base font-bold hover:opacity-80 transition-opacity" style={{ animationDelay: '0.9s' }}>About</button>
            <button onClick={() => navigate('/contact')} className="cf-shine-text text-base font-bold hover:opacity-80 transition-opacity" style={{ animationDelay: '1.2s' }}>Contact</button>
            <button onClick={() => navigate('/login')} className="cf-shine-text text-base font-bold hover:opacity-80 transition-opacity" style={{ animationDelay: '1.5s' }}>
              Login
            </button>
            <PremiumButton onClick={() => navigate('/signup')} size="sm" variant="mono">
              Start Free Today
            </PremiumButton>
          </div>
        </div>
      </nav>
    </div>
  );
}
