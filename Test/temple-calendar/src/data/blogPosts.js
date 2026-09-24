/**
 * src/data/blogPosts.js
 * Content for the marketing site's Blog (BlogPage.jsx / BlogPostPage.jsx).
 * Plain data on purpose — no CMS yet, so adding a post is just adding an
 * entry here. `content` is an array of strings; a string starting with
 * "## " renders as a subheading, everything else as a paragraph.
 */
export const BLOG_POSTS = [
  {
    slug: 'get-to-your-people-faster',
    title: 'Get to Your People, Faster',
    excerpt:
      'Most of the time an organizer loses between deciding to send an update and it actually reaching someone isn’t indecision — it’s tooling. Here’s how CalendarFly collapses that gap.',
    date: '2026-09-02',
    readTime: '4 min read',
    content: [
      'An event changes room, a volunteer drops out, the weather turns — and someone has to tell everyone, right now, wherever they actually check their messages. That used to mean opening four different apps, writing four slightly different versions of the same update, and hoping nobody missed it.',
      '## The real bottleneck isn’t the message, it’s the handoff',
      'Writing the update is the easy part. The time actually gets lost in the handoff between writing it and getting it in front of people — switching apps, re-typing the same sentence for WhatsApp, Facebook, Instagram, and email, resizing an image four different ways, and checking each platform separately to confirm it went out.',
      'CalendarFly’s Broadcast composer treats that handoff as the thing to eliminate, not the message itself. Write once, pick the channels, send — and the send status for every channel shows up in one place, so you’re not tab-switching to confirm delivery.',
      '## Faster flyers mean faster broadcasts',
      'A broadcast is only as fast as the flyer behind it. Flyer Studio generates an on-brand image from a plain-language prompt in seconds, so the design step stops being the reason an announcement goes out a day late.',
      'Put together, a calendar that already knows your event details, a flyer that takes a sentence instead of a design session, and a broadcast that reaches every channel from one screen add up to the same outcome every time: your community hears about it while it still matters.',
    ],
  },
  {
    slug: 'flyer-studio-five-minutes',
    title: 'Build a Flyer in Under Five Minutes with Flyer Studio',
    excerpt:
      'You don’t need design software or a volunteer who "does graphics" to put out a flyer that looks like someone spent an afternoon on it.',
    date: '2026-08-21',
    readTime: '3 min read',
    content: [
      'Most event flyers never get made because the person running the event isn’t a designer, and the person who is a designer is busy. Flyer Studio is built around that reality — it asks for a plain description, not a design brief.',
      '## Start with a sentence, not a blank canvas',
      'Type what the flyer is for — "warm, festive flyer for a fall potluck, orange and cream tones" — and Flyer Studio generates an image built around that description, already sized for a social post or a printed page. From there you can swap the text, adjust colors to match your organization’s branding, and drop in the event’s date and time.',
      '## It stays on-brand automatically',
      'Once your organization’s colors and logo are set up in Settings, every flyer you generate uses them by default — so a flyer made by whoever’s free that day still looks like it came from the same organization as the one before it.',
      'The goal isn’t to replace a designer who wants creative control. It’s to make sure the events that would otherwise go out with no flyer at all — because nobody had twenty minutes to open design software — get one anyway.',
    ],
  },
  {
    slug: 'run-your-organization-like-a-studio',
    title: 'Run Your Organization Like a Studio',
    excerpt:
      'A small team can look and feel as sharp as a full-time events studio — the tools just have to fit around the fact that everyone involved has another job.',
    date: '2026-08-10',
    readTime: '4 min read',
    content: [
      'Community organizations rarely run on a full-time staff. The person managing next month’s calendar is usually also the person who’ll be setting up chairs the morning of. Tools built for a marketing department don’t fit that reality — too many steps, too many logins, too much assumed context.',
      '## Consolidate instead of coordinate',
      'The biggest time cost for a volunteer-run organization usually isn’t any single task — it’s coordinating across tools that don’t talk to each other: a calendar in one app, flyers made in another, announcements sent by hand in a group chat, and RSVP counts tracked in a spreadsheet nobody quite trusts.',
      'CalendarFly keeps those four things — calendar, flyers, broadcast, and RSVPs — in one place on purpose, so adding an event once is enough: the calendar updates, a flyer can be generated from the same details, the broadcast pulls the same date and time, and RSVPs land back on the same event.',
      '## Consistency without a full-time hand on it',
      'A studio looks polished because the same person (or the same system) touches every piece of what goes out. When five different volunteers each handle one event, that consistency usually disappears — unless the tool itself is what’s keeping the branding, tone, and format the same. That’s the part CalendarFly is trying to carry so your team doesn’t have to.',
    ],
  },
  {
    slug: 'one-message-every-channel',
    title: 'One Message, Every Channel: How Omnichannel Broadcast Works',
    excerpt:
      'Your community isn’t all on one platform. Reaching everyone shouldn’t mean writing the announcement four times.',
    date: '2026-07-29',
    readTime: '3 min read',
    content: [
      'Every organization ends up split across platforms — some people only check WhatsApp, others only see Facebook, a few actually read email. Picking one channel means quietly losing whoever isn’t on it.',
      '## Write once, choose your channels',
      'Broadcast is built around a single message and a set of channel checkboxes: WhatsApp, Facebook, Instagram, and email are all available from the same screen, and you decide per-message which ones make sense — a time-sensitive reminder might go everywhere, while a longer update might just go to email.',
      '## Know what actually landed with WhatsApp Business',
      'The trade-off with WhatsApp is that Meta requires a message either fall inside a 24-hour customer-service window or use a pre-approved template outside it — that’s a platform rule, not a CalendarFly limitation, and Broadcast shows you which situation you’re in before you send so there are no surprise failures.',
      'The point of Omnichannel Broadcast isn’t novelty — it’s that the effort to reach four platforms should be the same as the effort to reach one.',
    ],
  },
];

export function getPostBySlug(slug) {
  return BLOG_POSTS.find((p) => p.slug === slug) || null;
}
