/**
 * PremiumLanding - Studio-quality landing page
 * Black & white by design (no gradients/accent colors) — white background,
 * black text. See BrandMark.jsx, PremiumButton.jsx's 'dark'/'darkOutline'
 * variants, and MarketingNav/MarketingFooter for the rest of the
 * monochrome marketing site.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';
import MarketingNav from './components/MarketingNav';
import MarketingFooter from './components/MarketingFooter';
import { useAuth } from './contexts/AuthContext';

// Organization categories this app actually stores (see CATEGORY_LABELS /
// CATEGORY_META in pages/PublicRadarPage.jsx and the signup taxonomy in
// OnboardingWizard.jsx) -- not the illustrative "Spiritual / Arts & Culture /
// Music & Dance" pill set from the original mockup, which doesn't
// correspond to any field the backend actually stores.
// Real, actually-assignable category keys (see OnboardingWizard.jsx /
// utils/organizationCategories.js) -- cultural_association/community_center
// below used to be illustrative placeholders no real org could ever have,
// so these pills silently matched nothing. A representative handful here;
// "More" links to /explore, which has the full category list.
const TEASER_CATEGORY_FILTERS = [
  { key: 'temple', label: 'Temples' },
  { key: 'dance_school', label: 'Dance' },
  { key: 'restaurant', label: 'Restaurants' },
  { key: 'community', label: 'Community' },
];
function teaserCategoryLabel(cat) {
  const known = TEASER_CATEGORY_FILTERS.find((f) => f.key === cat);
  if (known) return known.label;
  if (!cat) return 'Organization';
  return cat.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}
function teaserIsToday(dateStr) {
  if (!dateStr) return false;
  const t = new Date();
  const iso = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  return dateStr === iso;
}
function teaserIsThisWeekend(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d - today) / 86400000);
  if (diffDays < 0 || diffDays > 6) return false;
  const day = d.getDay();
  return day === 0 || day === 6;
}
function teaserFormatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

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
  const location = useLocation();

  // Lets MarketingNav's "For Organizations" link work as a same-page anchor
  // (/#for-organizations) whether you're already on the homepage or arriving
  // fresh from another page -- plain browser hash-scroll doesn't reliably
  // fire on client-side route changes, so we do it ourselves on mount/hash
  // change, after layout has a moment to settle.
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    // Retried a few times: right after a cross-page navigation, AuthContext /
    // TempleConfig are still resolving and can trigger a re-render that
    // collapses and regrows page height, which clamps scrollY back to 0
    // between our attempts. A few spaced retries ride that out; the last
    // one or two are harmless no-ops once layout has settled.
    const delays = [100, 400, 900, 1500];
    const timers = delays.map((ms) => setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, ms));
    return () => timers.forEach(clearTimeout);
  }, [location.hash]);
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


  // "Happening near you" teaser -- pulls from the same public,
  // unauthenticated GET /api/radar feed /explore uses (server/routes/radar.js),
  // so nothing here is fabricated. Search and the pills below filter what's
  // already loaded; "See all on Explore" hands off to the full page for
  // everything this teaser doesn't cover (Community Passport, nearby-orgs
  // list, saved events, etc).
  const [teaserEvents, setTeaserEvents] = useState([]);
  const [teaserLoading, setTeaserLoading] = useState(true);
  const [teaserError, setTeaserError] = useState('');
  const [teaserQuery, setTeaserQuery] = useState('');
  const [teaserFilter, setTeaserFilter] = useState(null); // 'today' | 'weekend' | a category key | null

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/radar?limit=40');
        if (!res.ok) throw new Error('radar fetch failed');
        const data = await res.json();
        if (!cancelled) setTeaserEvents(Array.isArray(data.events) ? data.events : []);
      } catch {
        if (!cancelled) setTeaserError('Could not load nearby events right now.');
      } finally {
        if (!cancelled) setTeaserLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const teaserFiltered = teaserEvents.filter((ev) => {
    if (teaserQuery.trim()) {
      const q = teaserQuery.trim().toLowerCase();
      const hay = `${ev.title || ''} ${ev.org?.name || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (teaserFilter === 'today') return teaserIsToday(ev.date);
    if (teaserFilter === 'weekend') return teaserIsThisWeekend(ev.date);
    if (teaserFilter) return ev.org?.category === teaserFilter;
    return true;
  }).slice(0, 4);

  const handleTeaserSearch = (e) => {
    e.preventDefault();
    // Filtering already happens live as the fields above change -- this
    // just keeps Enter/click on "Search" from reloading the page.
  };

  return (
    <div className="min-h-screen bg-white text-black overflow-hidden">
      <MarketingNav />

      {/* Good things happen near you -- CalendarFly's other audience:
          someone who just wants to find real events happening nearby, not
          sign up to manage anything. Same monochrome design system as the
          rest of this page (see file header) -- deliberately not styled
          like /explore's warm/orange treatment, since that page is one
          click away via "See all on Explore" rather than duplicated here.
          The event row below is the live public GET /api/radar feed, the
          same one /explore uses -- no fabricated attendee counts, stock
          photos, or "trending" labels. */}
      <section className="pt-32 md:pt-40 pb-32 px-6 bg-white text-black border-t border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-block text-xs font-semibold tracking-widest text-black/40 mb-6 uppercase">For people, not just organizations</div>
            <h2 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
              Good things happen
              <br />
              <span className="italic" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>near you.</span>
            </h2>
            <p className="text-lg text-black/60 mb-8 leading-relaxed">
              Every temple, cultural group, and nonprofit on CalendarFly in one place. No account needed to browse.
            </p>
            <form onSubmit={handleTeaserSearch} className="flex gap-2 max-w-lg mx-auto mb-5">
              <input
                type="text"
                value={teaserQuery}
                onChange={(e) => setTeaserQuery(e.target.value)}
                placeholder="Search events or organizations..."
                className="flex-1 px-5 py-3 rounded-full border border-gray-300 focus:outline-none focus:border-black text-sm"
              />
              <PremiumButton type="submit" variant="dark" size="md">Search</PremiumButton>
            </form>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setTeaserFilter(teaserFilter === 'today' ? null : 'today')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${teaserFilter === 'today' ? 'bg-black text-white border-black' : 'border-gray-300 text-black/60 hover:border-black/60'}`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setTeaserFilter(teaserFilter === 'weekend' ? null : 'weekend')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${teaserFilter === 'weekend' ? 'bg-black text-white border-black' : 'border-gray-300 text-black/60 hover:border-black/60'}`}
              >
                This weekend
              </button>
              {TEASER_CATEGORY_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setTeaserFilter(teaserFilter === f.key ? null : f.key)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${teaserFilter === f.key ? 'bg-black text-white border-black' : 'border-gray-300 text-black/60 hover:border-black/60'}`}
                >
                  {f.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => navigate('/explore')}
                className="px-4 py-1.5 rounded-full text-xs font-semibold border border-gray-300 text-black/60 hover:border-black/60 transition"
              >
                More &rarr;
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-10 items-start">
            <div className="lg:col-span-2 rounded-3xl overflow-hidden" style={{ aspectRatio: '4 / 5' }}>
              <img
                src="/marketing/contact-temple.jpg"
                alt="A family at a temple by the water at dusk"
                className="w-full h-full object-cover"
                style={{ filter: 'grayscale(1)' }}
              />
            </div>

            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold">Happening near you</h3>
                <button
                  type="button"
                  onClick={() => navigate('/explore')}
                  className="text-sm font-semibold underline underline-offset-4 hover:no-underline flex-shrink-0"
                >
                  See all on Explore &rarr;
                </button>
              </div>

              {teaserLoading ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : teaserError ? (
                <p className="text-black/50 text-sm">
                  {teaserError}{' '}
                  <button type="button" onClick={() => navigate('/explore')} className="underline">Try Explore instead &rarr;</button>
                </p>
              ) : teaserFiltered.length === 0 ? (
                <p className="text-black/50 text-sm">
                  Nothing matches yet.{' '}
                  <button type="button" onClick={() => navigate('/explore')} className="underline">See everything on Explore &rarr;</button>
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {teaserFiltered.map((ev) => (
                    <button
                      key={ev.event_id}
                      type="button"
                      onClick={() => navigate('/explore')}
                      className="text-left rounded-2xl border border-gray-200 hover:border-black/40 transition p-4 flex gap-3"
                    >
                      <div className="w-14 h-14 rounded-xl flex-shrink-0 bg-gray-100 overflow-hidden flex items-center justify-center">
                        {ev.image_url ? (
                          <img src={ev.image_url} alt="" className="w-full h-full object-cover" style={{ filter: 'grayscale(1)' }} />
                        ) : (
                          <span className="text-lg font-bold text-black/30">{(ev.org?.name || '?').charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{ev.title}</div>
                        <div className="text-xs text-black/50 truncate">{ev.org?.name} &middot; {teaserCategoryLabel(ev.org?.category)}</div>
                        <div className="text-xs text-black/40 mt-1">{teaserFormatDate(ev.date)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Organizations hero -- moved here from the very top of the page.
          This is CalendarFly's admin-facing pitch (the dashboard preview,
          "Events simplified, Community amplified"), so it belongs under
          #for-organizations, not as the default view for every visitor.
          The "For people" section above is now the page's actual top. */}
      <section id="for-organizations" className="relative overflow-hidden px-6 py-32 scroll-mt-24" style={{ background: '#f4f4f6' }}>
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
