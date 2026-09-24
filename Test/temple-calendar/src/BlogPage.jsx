/**
 * BlogPage - marketing site blog index. Monochrome, matches
 * PremiumLanding/MarketingNav/MarketingFooter's black & white treatment.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import MarketingNav from './components/MarketingNav';
import MarketingFooter from './components/MarketingFooter';
import BlogPostVisual from './components/BlogPostVisual';
import { BLOG_POSTS } from './data/blogPosts';

function formatDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function BlogPage() {
  const navigate = useNavigate();
  const [featured, ...rest] = BLOG_POSTS;

  return (
    <div className="min-h-screen bg-white text-black">
      <MarketingNav />

      <section className="pt-40 md:pt-48 pb-16 px-6 border-b border-gray-200">
        <div className="max-w-5xl mx-auto">
          <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Blog</span>
          <h1 className="text-5xl md:text-6xl font-bold mt-3 mb-4">Notes on running events well</h1>
          <p className="text-xl text-gray-500 max-w-2xl">
            How we think about calendars, flyers, and broadcasting — and how organizations use CalendarFly to spend less time on logistics.
          </p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Featured post */}
          <button
            onClick={() => navigate(`/blog/${featured.slug}`)}
            className="block text-left w-full mb-16 pb-16 border-b border-gray-200 group"
          >
            <BlogPostVisual slug={featured.slug} size="lg" className="mb-6" />
            <span className="text-xs uppercase tracking-[0.15em] text-gray-400">{formatDate(featured.date)} · {featured.readTime}</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4 group-hover:text-gray-600 transition-colors">{featured.title}</h2>
            <p className="text-lg text-gray-500 max-w-3xl">{featured.excerpt}</p>
            <span className="inline-block mt-4 text-sm font-semibold border-b border-black group-hover:border-gray-400">Read the post →</span>
          </button>

          {/* Rest of posts */}
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-12">
            {rest.map((post) => (
              <button
                key={post.slug}
                onClick={() => navigate(`/blog/${post.slug}`)}
                className="block text-left group"
              >
                <BlogPostVisual slug={post.slug} size="md" className="mb-4" />
                <span className="text-xs uppercase tracking-[0.15em] text-gray-400">{formatDate(post.date)} · {post.readTime}</span>
                <h3 className="text-2xl font-bold mt-2 mb-3 group-hover:text-gray-600 transition-colors">{post.title}</h3>
                <p className="text-gray-500 leading-relaxed">{post.excerpt}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
