import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import TiptapRenderer, { type ASTNode } from "../components/TiptapRenderer";

interface PostRow {
  slug: string;
  title: string;
  date: string;
  ast: string;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<PostRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/posts/${slug}`)
      .then((r) => { if (!r.ok) { setNotFound(true); setLoading(false); return null; } return r.json(); })
      .then((data) => { if (data) { setPost(data.post); } setLoading(false); })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  if (loading) return <div className="w-full max-w-4xl mx-auto px-6 py-24 text-white/80 animate-pulse">Loading post...</div>;
  if (notFound || !post) return <div className="w-full max-w-4xl mx-auto px-6 py-24 text-white/80">Post not found.</div>;

  let parsedAst: ASTNode = { type: "doc", content: [] };
  try { parsedAst = JSON.parse(post.ast); } catch { /* Ignore parse error */ }

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <div className="w-full max-w-4xl mx-auto px-6 py-12 md:py-24">
        <Link to="/blog" className="text-ares-gold hover:underline text-sm mb-8 inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">&larr; Back to all posts</Link>
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">{post.title}</h1>
          <p className="text-ares-red font-medium">{post.date}</p>
        </header>
        <article className="prose prose-invert lg:prose-lg max-w-none prose-headings:text-white prose-p:text-white/80 prose-a:text-ares-gold prose-a:focus-visible:outline-none prose-a:focus-visible:ring-2 prose-a:focus-visible:ring-ares-cyan prose-a:rounded">
          <TiptapRenderer node={parsedAst} />
        </article>
      </div>
    </div>
  );
}
