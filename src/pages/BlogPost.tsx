import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { trackPageView } from "../utils/analytics";

import TiptapRenderer, { type ASTNode } from "../components/TiptapRenderer";
import CommentSection from "../components/CommentSection";

interface PostRow {
  slug: string;
  title: string;
  date: string;
  ast: string;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading, isError } = useQuery<PostRow>({
    queryKey: ["post", slug],
    queryFn: async () => {
      const r = await fetch(`/api/posts/${slug}`);
      if (!r.ok) throw new Error("Not found");
      const data = await r.json();
      // @ts-expect-error -- D1 untyped response
      if (!data || !data.post) throw new Error("Not found");
      // @ts-expect-error -- D1 untyped response
      return data.post;
    },
    enabled: !!slug,
    retry: false, // Don't retry 404s
  });

  useEffect(() => {
    if (post && slug) {
      trackPageView(`/blog/${slug}`, 'blog');
    }
  }, [post, slug]);

  if (isLoading) return <div className="w-full max-w-4xl mx-auto px-6 py-24 text-white/80 animate-pulse">Loading post...</div>;
  if (isError || !post) return <div className="w-full max-w-4xl mx-auto px-6 py-24 text-white/80">Post not found.</div>;

  let parsedAst: ASTNode = { type: "doc", content: [] };
  try { parsedAst = JSON.parse(post.ast); } catch { /* Ignore parse error */ }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full min-h-screen bg-obsidian text-marble py-8"
    >
      <div className="w-full max-w-4xl mx-auto px-6 py-12 md:py-24">
        <Link to="/blog" className="text-ares-gold hover:underline text-sm mb-8 inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">&larr; Back to all posts</Link>
        <motion.header 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tighter mb-4">{post.title}</h1>
          <p className="text-ares-red font-medium">{format(new Date(post.date), 'MMMM do, yyyy')}</p>
        </motion.header>
        <motion.article 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="prose prose-invert lg:prose-lg max-w-none prose-headings:text-white prose-p:text-white/80 prose-a:text-ares-gold prose-a:focus-visible:outline-none prose-a:focus-visible:ring-2 prose-a:focus-visible:ring-ares-cyan prose-a:rounded"
        >
          <TiptapRenderer node={parsedAst} />

          {/* Comments (auth-gated) */}
          {slug && <CommentSection targetType="post" targetId={slug} />}
        </motion.article>
      </div>
    </motion.div>
  );
}
