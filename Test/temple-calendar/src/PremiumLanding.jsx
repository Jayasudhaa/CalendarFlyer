/**
 * PremiumLanding - Studio-quality landing page
 * Black & white by design (no gradients/accent colors) — white background,
 * black text. See BrandMark.jsx, PremiumButton.jsx's 'dark'/'darkOutline'
 * variants, and MarketingNav/MarketingFooter for the rest of the
 * monochrome marketing site.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';
import MarketingNav from './components/MarketingNav';
import MarketingFooter from './components/MarketingFooter';
import { useAuth } from './contexts/AuthContext';

function FeatureIcon({ children }) {
  return (
    <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center text-3xl mb-4">
      {children}
    </div>
  );
}

// Scroll-triggered reveal for the "See It In Action" cards below — plain
// IntersectionObserver, no animation library needed. Fires once per card
// (unobserves itself right after) so scrolling back up and down past the
// section doesn't replay the pop-in every time.
function useInView(threshold = 0.2) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, inView];
}

// The four "See It In Action" showcase images (PremiumLanding demo section)
// — illustrative concept renders of the product, not literal screenshots;
// kept in full color as a deliberate one-section exception to the site's
// otherwise strict black & white system (product decision, not a bug).
const DEMO_ITEMS = [
  {
    src: '/marketing/demo-calendar.jpg',
    label: 'yourorg.calendarflyapp.com/calendar',
    caption: 'Public Calendar',
    description: 'One shareable calendar your whole community can check — month, week, or list view, on any device.',
    alt: 'A colorful public event calendar shown on desktop and mobile, listing community events by date',
  },
  {
    src: '/marketing/demo-flyer-studio.jpg',
    label: 'AI Flyer Studio',
    caption: 'AI Flyer Studio',
    description: 'Describe the event and get an on-brand flyer back in seconds — resized automatically for every platform.',
    alt: 'The AI Flyer Studio editor generating a festival flyer, with template, color, and layout options',
  },
  {
    src: '/marketing/demo-broadcast.jpg',
    label: 'Omnichannel Broadcast',
    caption: 'Omnichannel Broadcast',
    description: 'Pick a flyer, hit send — it reaches WhatsApp, Instagram, email, and more in one motion.',
    alt: 'An event flyer broadcasting outward to WhatsApp, Instagram, email, and notification icons',
  },
  {
    src: '/marketing/demo-chatbot-analytics.jpg',
    label: 'AI Chatbot & Advanced Analytics',
    caption: 'AI Chatbot & Advanced Analytics',
    description: 'Your AI assistant answers event questions instantly, while RSVPs and attendance roll into one dashboard.',
    alt: 'A phone chat with an AI assistant answering an event question, next to a laptop showing an event analytics dashboard',
  },
];

// One demo card — owns its own reveal-on-scroll state via useInView() so
// each of the four cards pops in independently as it enters the viewport,
// staggered by `index` (see --cf-demo-delay, index.css). Image zooms in
// gently on hover/focus (.cf-demo-media img, same stylesheet).
function DemoCard({ item, index }) {
  const [ref, inView] = useInView(0.2);
  return (
    <div ref={ref} className="block">
      <GlassCard
        light
        className={`p-0 overflow-hidden cf-demo-card${inView ? ' cf-demo-in' : ''}`}
        style={{ '--cf-demo-delay': `${index * 0.12}s` }}
      >
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <span className="w-3 h-3 rounded-full bg-gray-300" /><span className="w-3 h-3 rounded-full bg-gray-300" /><span className="w-3 h-3 rounded-full bg-gray-300" />
          <span className="ml-3 text-xs text-gray-500">{item.label}</span>
        </div>
        <div className="cf-demo-media aspect-[4/3]">
          <img src={item.src} alt={item.alt} className="w-full h-full object-cover" />
        </div>
        <div className="px-5 py-4 border-t border-gray-100">
          <div className="text-sm font-bold text-black mb-1">{item.caption}</div>
          <div className="text-xs text-gray-500 leading-relaxed">{item.description}</div>
        </div>
      </GlassCard>
    </div>
  );
}

export default function PremiumLanding() {
  const navigate = useNavigate();
  const { startGuestSandbox } = useAuth();
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxError, setSandboxError] = useState('');

  const handleGuestSandbox = async () => {
    setSandboxError('');
    setSandboxLoading(true);
    const result = await startGuestSandbox('temple');
    setSandboxLoading(false);
    if (result.success) {
      // A guest sandbox owner can manage their sandbox org, so this always
      // goes straight to the admin dashboard (see AuthContext.jsx --
      // startGuestSandbox's account is seeded with a real, manageable role,
      // never 'viewer').
      navigate('/dashboard');
    } else {
      setSandboxError(result.error || 'Could not start a sandbox session — please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-white text-black overflow-hidden">
      <MarketingNav />

      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 pt-32 pb-20 md:pt-40 lg:pt-48 lg:pb-28" style={{ background: '#f4f4f6' }}>
        {/* Layered grey/white facets + monochrome geometry — a textured,
            "premium" backdrop instead of a flat fill, still strictly
            black & white so it matches the rest of the brand. */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {/* Soft diagonal wash */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(128deg, #eeeef1 0%, #f8f8f9 38%, #ffffff 62%, #eceef0 100%)' }} />
          {/* Faceted diagonal panels, a shade apart from the wash */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(0,0,0,0.035) 0%, transparent 30%)', clipPath: 'polygon(0 0, 42% 0, 16% 100%, 0% 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(80deg, transparent 0%, rgba(0,0,0,0.03) 100%)', clipPath: 'polygon(58% 0, 100% 0, 100% 65%, 34% 100%)' }} />
          <div className="absolute inset-0" style={{ background: '#ffffff', opacity: 0.5, clipPath: 'polygon(70% 0, 100% 0, 100% 40%, 82% 100%, 55% 100%)' }} />

          <svg className="absolute -top-16 right-[-6rem] w-[38rem] h-[38rem] opacity-[0.05]" viewBox="0 0 100 100">
            <rect x="15" y="15" width="70" height="70" transform="rotate(45 50 50)" fill="none" stroke="black" strokeWidth="0.5" />
            <rect x="28" y="28" width="44" height="44" transform="rotate(45 50 50)" fill="none" stroke="black" strokeWidth="0.5" />
            <rect x="40" y="40" width="20" height="20" transform="rotate(45 50 50)" fill="none" stroke="black" strokeWidth="0.5" />
          </svg>
          <div className="absolute top-24 right-[-4rem] w-[30rem] h-[30rem] rounded-full border border-black/[0.06]" />
          <div className="absolute top-40 right-[6rem] w-[30rem] h-[30rem] rounded-full border border-black/[0.05]" />

          {/* Twinkling sparkle dots — soft grey glints on the light backdrop,
              see .cf-sparkle-dark in index.css. */}
          <span className="cf-sparkle-dark" style={{ width: 4, height: 4, top: '18%', right: '22%', animationDelay: '0.2s' }} />
          <span className="cf-sparkle-dark" style={{ width: 3, height: 3, top: '38%', right: '38%', animationDelay: '1.1s' }} />
          <span className="cf-sparkle-dark" style={{ width: 3, height: 3, top: '58%', right: '12%', animationDelay: '1.9s' }} />
          <span className="cf-sparkle-dark" style={{ width: 5, height: 5, top: '72%', right: '30%', animationDelay: '0.7s' }} />
          <span className="cf-sparkle-dark" style={{ width: 3, height: 3, top: '12%', right: '48%', animationDelay: '2.4s' }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-x-16 gap-y-16 items-center">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full bg-black/[0.04] border border-black/10">
              <span className="w-1.5 h-1.5 rounded-full bg-black" />
              <span className="text-xs font-semibold tracking-wider text-gray-700 uppercase">Event Management for Community Organizations</span>
            </div>

            <h1
              className="text-5xl sm:text-6xl xl:text-[4rem] font-black leading-[0.98] tracking-tight mb-6"
              style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            >
              Events simplified,
              <br />
              Community amplified.
            </h1>

            <p className="text-lg text-gray-600 leading-relaxed max-w-lg mb-8">
              CalendarFly gives community organizations the calendar, AI flyer studio, and broadcast tools big media teams take for granted — post once and reach every channel automatically.
            </p>

            {/* Try the Live Demo is the main CTA (a real, working sandbox —
                no waiting on a recorded video, no signup); Start Free is
                the secondary path for someone ready to commit. Sign In
                isn't repeated here — it's one click away in the nav above. */}
            <div className="flex flex-col sm:flex-row gap-4">
              <PremiumButton
                type="button"
                size="lg"
                variant="dark"
                disabled={sandboxLoading}
                onClick={handleGuestSandbox}
              >
                {sandboxLoading ? 'Setting up your sandbox…' : 'Try the Live Demo →'}
              </PremiumButton>
              <PremiumButton onClick={() => navigate('/signup')} size="lg" variant="darkOutline">
                Start Free Today
              </PremiumButton>
            </div>
            {sandboxError && (
              <p className="mt-3 text-sm text-red-600">{sandboxError}</p>
            )}

            <p className="mt-6 text-sm text-gray-400">No signup for the live demo • No credit card to start free</p>
          </div>

          {/* Real product demo — a short screen recording, muted/looping like
              any hero video (autoplay only works muted in browsers), with
              native controls so a visitor can pause/unmute/scrub. */}
          <div className="relative">
            <div className="relative rounded-[28px] bg-white border border-black/10 shadow-[0_30px_80px_-25px_rgba(0,0,0,0.25)] p-3">
              <div className="relative rounded-2xl overflow-hidden border border-black/5 aspect-video bg-black">
                <div className="absolute top-4 left-4 z-10 text-[10px] font-semibold uppercase tracking-wider text-gray-500 bg-white/80 backdrop-blur px-2.5 py-1 rounded-full border border-black/5">
                  Preview
                </div>
                <video
                  className="w-full h-full object-cover"
                  src="/videos/product-demo.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                  aria-label="CalendarFly product demo"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For the community, not just the org running it -- CalendarFly's
          other audience: someone who just wants to find events near them,
          not sign up to manage anything. Points at the Explore page
          (server/routes/discover.js's nearby-org feature + the Community
          Passport identity in identity-auth.js), which had no presence
          anywhere on the marketing site before this. Deliberately visually
          distinct (dark section, amber preview card) so it reads as a
          second audience, not another row of admin features. */}
      <section className="py-32 px-6 bg-black text-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-block text-xs font-semibold tracking-widest text-white/50 mb-6 uppercase">For your community</div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Not running an org?
              <br />
              Just find what's near you.
            </h2>
            <p className="text-lg text-white/60 mb-10 leading-relaxed max-w-md">
              Every temple, cultural group, and nonprofit on CalendarFly in one place. No account needed to browse — verify your email once for picks made for you.
            </p>
            <div className="space-y-6 mb-10">
              {[
                { icon: '📍', title: 'Nearby', body: "See what's happening within 15 miles, from every organization on CalendarFly." },
                { icon: '❤️', title: 'Picked for you', body: 'Choose a few interests — music, yoga, volunteering, and more — to sharpen what you see.' },
                { icon: '🔖', title: 'Follow your favorites', body: "Verify your email once, follow the organizations you care about, and never miss what they post." },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="text-2xl flex-shrink-0">{item.icon}</div>
                  <div>
                    <div className="font-semibold mb-1">{item.title}</div>
                    <div className="text-white/50 text-sm leading-relaxed">{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <PremiumButton onClick={() => navigate('/explore')} size="lg" variant="mono">
              Explore near you →
            </PremiumButton>
          </div>

          {/* Illustrative preview of the actual Explore page -- the one
              deliberately non-monochrome element on this page, since a
              product preview should look like the product. */}
          <div className="rounded-3xl p-6 md:p-8" style={{ background: '#fffdf7', border: '1px solid #d4af37' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-bold" style={{ background: 'linear-gradient(160deg,#ea580c,#92400e)', color: '#fff', fontFamily: "'Playfair Display', Georgia, serif" }}>
                A
              </div>
              <div>
                <div className="text-xs" style={{ color: '#9a7a55' }}>Welcome back</div>
                <div className="font-extrabold" style={{ color: '#3d2008', fontFamily: "'Playfair Display', Georgia, serif" }}>My CalendarFly</div>
              </div>
            </div>
            <div className="inline-block px-4 py-1.5 rounded-lg mb-4 font-extrabold text-lg" style={{ background: '#faeeda', color: '#3d2008', fontFamily: "'Playfair Display', Georgia, serif" }}>
              📍 Recommended near you
            </div>
            <div className="rounded-xl p-4 mb-3" style={{ background: '#ffffff', border: '1px solid #e8d5a3' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg flex-shrink-0" style={{ background: 'linear-gradient(160deg,#ea580c,#92400e)' }} />
                <div>
                  <div className="text-sm font-bold" style={{ color: '#3d2008' }}>Sri Venkateswara Temple</div>
                  <div className="text-xs" style={{ color: '#9a7a55' }}>3.9 mi away · Temple</div>
                </div>
              </div>
              <div className="text-xs" style={{ color: '#7a5a3a' }}>Next: Navratri Begins · Tue, Sep 22</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Spiritual', 'Music', 'Kids & family'].map((tag) => (
                <span key={tag} className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#faeeda', color: '#7a3b00' }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* "Running an org?" label -- short intro to the admin-facing content
          below (Before/Problem, Features, Demo, CTA), which is otherwise
          unchanged in content and order. */}
      <div className="max-w-7xl mx-auto px-6 pt-32">
        <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase">Running an org?</span>
        <h2 className="text-4xl sm:text-5xl font-bold mt-3">This is for you.</h2>
      </div>

      {/* Before/Problem Section — a real photo (desaturated to match the
          site's black & white system) instead of the app's own screenshots,
          so it reads as "the mess CalendarFly replaces" rather than more
          product marketing. Copy is set natively here rather than baked
          into an image, so it stays on-brand typographically. */}
      <section className="py-16 px-6 border-t border-gray-200">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="rounded-3xl overflow-hidden border border-black/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)]">
            <img
              src="/marketing/before-calendarfly.jpg"
              alt="A volunteer surrounded by sticky notes, spreadsheets, and printed flyers while coordinating a temple event by hand"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase">Before CalendarFly</span>
            <h2 className="text-4xl sm:text-5xl font-bold mt-3 mb-6 leading-tight">
              From chaos to clarity.
              <br />
              From hours to minutes.
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-4">
              Managing RSVPs in a spreadsheet. Endless WhatsApp messages. Designing flyers by hand. Chasing volunteers with reminders. Last-minute stress before every event.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed">
              CalendarFly replaces all of it with one dashboard — sync your calendar, manage RSVPs and volunteers, generate flyers automatically, and broadcast everywhere in one click.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold mb-6">
              Everything You Need,
              <br />
              Nothing You Don't
            </h2>
            <p className="text-xl text-gray-500">Built for community organizations, designed like a studio</p>
          </div>

          {/* The four primary features — see /features for the full list
              (Bulk Import, RSVP Tracking, Multi-Tenant Admin, Advanced
              Analytics, etc.), kept off the homepage so this stays a
              teaser, not a duplicate of the dedicated page. */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: '📅',
                title: 'Smart Calendar',
                description: 'Beautiful, responsive calendars with intelligent event management and automatic scheduling.',
              },
              {
                icon: '🎨',
                title: 'AI Flyer Studio',
                description: 'Generate stunning event flyers in seconds from a plain-language prompt, on-brand every time.',
              },
              {
                icon: '📱',
                title: 'Omnichannel Broadcast',
                description: 'Send to WhatsApp, Facebook, Instagram with one click. Reach your community instantly.',
              },
              {
                icon: '🤖',
                title: 'AI Chatbot',
                description: '24/7 intelligent assistant answers questions about events, timings, and organization information.',
              },
            ].map((feature, idx) => (
              <GlassCard key={idx} light hover className="p-8">
                <FeatureIcon>{feature.icon}</FeatureIcon>
                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed">{feature.description}</p>
              </GlassCard>
            ))}
          </div>
          <div className="text-center mt-12">
            <button onClick={() => navigate('/features')} className="text-sm font-semibold border-b border-black hover:border-gray-400 hover:text-gray-500 transition-colors">
              See all features →
            </button>
          </div>
        </div>
      </section>

      {/* Product Demo Section */}
      <section id="demo" className="py-32 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-6">See It In Action</h2>
            <p className="text-xl text-gray-500">The four tools your team lives in — calendar, flyers, broadcast, and analytics.</p>
          </div>

          {/* How-it-works illustration — desaturated to grayscale to match
              the site's black & white system (the original is in color). */}
          <div className="rounded-3xl overflow-hidden border border-black/10 mb-16 max-w-4xl mx-auto shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)]">
            <img
              src="/marketing/how-it-works-bridge.jpg"
              alt="An illustration of a temple connected by a bridge to a phone showing calendar, WhatsApp, and photo icons — representing CalendarFly linking your temple to your community"
              className="w-full h-auto"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {DEMO_ITEMS.map((item, i) => (
              <DemoCard key={item.caption} item={item} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Blog moved off the homepage — it's a dedicated page (nav's "Blog"
          link, /blog) rather than a duplicated teaser here; kept the page
          shorter per the homepage-length feedback. */}

      {/* Pricing section removed from the homepage per request — full pricing
          still lives on its own dedicated page (nav's "Pricing" link, /pricing,
          see PricingMarketingPage.jsx) rather than being duplicated here. */}

      {/* CTA Section */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-bold mb-6">
            Ready to Transform
            <br />
            Your Community?
          </h2>
          <p className="text-xl text-gray-500 mb-12">
            Built for the volunteers and staff who run events on top of everything else they already do.
          </p>
          <PremiumButton onClick={() => navigate('/signup')} size="lg" variant="dark">
            Start Free Today →
          </PremiumButton>
          <p className="mt-6 text-gray-400">No credit card • Cancel anytime • Free forever plan available</p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
