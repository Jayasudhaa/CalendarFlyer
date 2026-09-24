/**
 * BlogPostPage - single blog post, read by slug from data/blogPosts.js.
 * Monochrome, matches the rest of the marketing site.
 */
import React from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import MarketingNav from './components/MarketingNav';
import MarketingFooter from './components/MarketingFooter';
import BlogPostVisual from './components/BlogPostVisual';
import { getPostBySlug, BLOG_POSTS } from './data/blogPosts';
import { ArrowLeft } from 'lucide-react';

function formatDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const post = getPostBySlug(slug);

  if (!post) return <Navigate to="/blog" replace />;

  const more = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <div className="min-h-screen bg-white text-black">
      <MarketingNav />

      <article className="pt-40 md:pt-48 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => navigate('/blog')} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> Back to blog
          </button>

          <BlogPostVisual slug={post.slug} size="lg" className="mb-8" />
          <span className="text-xs uppercase tracking-[0.15em] text-gray-400">{formatDate(post.date)} · {post.readTime}</span>
          <h1 className="text-4xl md:text-5xl font-bold mt-3 mb-10 leading-tight">{post.title}</h1>

          <div className="space-y-6">
            {post.content.map((block, i) =>
              block.startsWith('## ') ? (
                <h2 key={i} className="text-2xl font-bold pt-4">{block.slice(3)}</h2>
              ) : (
                <p key={i} className="text-lg text-gray-600 leading-relaxed">{block}</p>
              )
            )}
          </div>
        </div>
      </article>

      {more.length > 0 && (
        <section className="py-16 px-6 border-t border-gray-200">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-sm uppercase tracking-[0.15em] text-gray-400 mb-6">More from the blog</h3>
            <div className="grid sm:grid-cols-2 gap-8">
              {more.map((p) => (
                <button key={p.slug} onClick={() => navigate(`/blog/${p.slug}`)} className="block text-left group">
                  <h4 className="text-lg font-bold mb-2 group-hover:text-gray-600 transition-colors">{p.title}</h4>
                  <p className="text-sm text-gray-500">{p.excerpt}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <MarketingFooter />
    </div>
  );
}
