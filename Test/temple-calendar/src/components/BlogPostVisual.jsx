/**
 * BlogPostVisual.jsx
 * Small monochrome line-icon "cover" for each blog post — one motif per
 * post, matched to what that post is actually about, so the blog isn't
 * pure text. Drawn as inline SVG (no photography) to stay perfectly
 * on-brand with the site's strict black & white system and to avoid
 * needing stock imagery that wouldn't match a specific post's topic.
 */
import React from 'react';

// "Get to Your People, Faster" — a signal reaching outward, arriving.
function SignalIcon(props) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <circle cx="14" cy="50" r="3" fill="currentColor" />
      <path d="M22 42a14 14 0 0 1 0 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 44c4-4 10-4 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 48c8-8 20-8 28 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 52c12-12 30-12 42 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="50" cy="16" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="50" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}

// "Build a Flyer in Under Five Minutes" — a flyer taking shape from a mark.
function FlyerIcon(props) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <rect x="16" y="10" width="28" height="38" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M22 20h16M22 26h16M22 32h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M40 40l10 10M50 40l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M46 38l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// "Run Your Organization Like a Studio" — layered sheets, aligned.
function StudioIcon(props) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <rect x="14" y="20" width="30" height="22" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <rect x="18" y="16" width="30" height="22" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <rect x="22" y="12" width="30" height="22" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M28 21h18M28 26h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// "One Message, Every Channel" — one point fanning out to several.
function ChannelsIcon(props) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <circle cx="16" cy="32" r="4" fill="currentColor" />
      <path d="M20 32h10M28 30l16-10M28 34l16 10M28 32h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="48" cy="22" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="48" cy="42" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="48" cy="32" r="3.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export const POST_VISUALS = {
  'get-to-your-people-faster': SignalIcon,
  'flyer-studio-five-minutes': FlyerIcon,
  'run-your-organization-like-a-studio': StudioIcon,
  'one-message-every-channel': ChannelsIcon,
};

// Photos supplied for specific posts, replacing the drawn icon above.
// `aspect` is the image's own native pixel ratio (width / height) — used as
// an inline style so the cover box always matches the photo exactly, with
// zero cropping, regardless of which fixed box ratio `size` would otherwise
// call for. 'flyer-studio-five-minutes' intentionally has no entry here and
// keeps its FlyerIcon SVG.
const POST_PHOTOS = {
  'get-to-your-people-faster': { src: '/marketing/blog-get-to-your-people.jpg', aspect: '1942 / 809' },
  'run-your-organization-like-a-studio': { src: '/marketing/blog-run-like-a-studio.jpg', aspect: '1536 / 1024' },
  'one-message-every-channel': { src: '/marketing/blog-one-message-every-channel.jpg', aspect: '1536 / 1024' },
};

/** Bordered cover block for a post card. size: 'lg' (featured) | 'md' (grid) | 'sm' (related). */
export default function BlogPostVisual({ slug, size = 'md', className = '' }) {
  const photo = POST_PHOTOS[slug];
  const Icon = POST_VISUALS[slug];
  if (!photo && !Icon) return null;

  const dims = {
    lg: { box: 'aspect-[21/9]', icon: 'w-14 h-14 md:w-20 md:h-20' },
    md: { box: 'aspect-video', icon: 'w-10 h-10 md:w-12 md:h-12' },
    sm: { box: 'aspect-[3/1]', icon: 'w-8 h-8' },
  }[size];

  if (photo) {
    return (
      <div
        className={`w-full rounded-xl bg-gray-50 border border-gray-200 overflow-hidden ${className}`}
        style={{ aspectRatio: photo.aspect }}
      >
        <img src={photo.src} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`${dims.box} w-full rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden ${className}`}>
      <Icon className={`${dims.icon} text-black`} />
    </div>
  );
}
