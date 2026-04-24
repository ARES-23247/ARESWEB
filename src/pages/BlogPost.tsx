import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { trackPageView } from "../utils/analytics";
import { useSession } from "../utils/auth-client";
import { Edit2 } from "lucide-react";

import TiptapRenderer, { type ASTNode } from "../components/TiptapRenderer";
import CommentSection from "../components/CommentSection";
import { api } from "../api/client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface PostRow {
  slug: string;
  title: string;
  date: string;
  ast: string;
  thumbnail?: string;
  author_nickname?: string;
  author_avatar?: string;
  cf_email?: string;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = useSession();
  
  const userRole = (session?.user as Record<string, unknown>)?.role || "user";
  const isEditor = userRole === "admin" || userRole === "author";

  const { data: postRes, isLoading, isError } = api.posts.getPost.useQuery({
    params: { slug: slug || "" },
  }, {
    queryKey: ["post", slug],
    enabled: !!slug,
    retry: false,
  });

  const post = postRes?.status === 200 ? postRes.body.post : null;

  useEffect(() => {
    if (post && slug) {
      trackPageView(`/blog/${slug}`, 'blog');
    }
  }, [post, slug]);

  if (isLoading) return <div className="w-full max-w-4xl mx-auto px-6 py-24 text-white animate-pulse">Loading post...</div>;
  if (isError || !post) return <div className="w-full max-w-4xl mx-auto px-6 py-24 text-white">Post not found.</div>;

  let parsedAst: ASTNode = { type: "doc", content: [] };
  try { parsedAst = JSON.parse(post.ast); } catch { /* Ignore parse error */ }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full min-h-screen bg-obsidian text-marble"
    >
      {/* ─── STANDALONE BLOG HERO ─── */}
      <section className="relative w-full h-[50vh] min-h-[400px] flex items-center overflow-hidden bg-obsidian border-b-4 border-ares-cyan">
        <img src={post.thumbnail || "/api/media/1776551060548-favicon.webp"} alt={post.title} className={`absolute inset-0 w-full h-full opacity-60 mix-blend-luminosity ${post.thumbnail ? 'object-cover' : 'object-contain p-16 bg-black/80'}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/70 to-transparent"></div>
        
        {/* Motif: Glowing orb overlay */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vh] h-[80vh] rounded-full border border-ares-cyan/10 shadow-[0_0_120px_rgba(0,192,192,0.15)] pointer-events-none mix-blend-screen animate-pulse-slow" aria-hidden="true"></div>
        
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="relative z-10 max-w-4xl mx-auto px-6 w-full mt-16"
        >
          <Link to="/blog" className="text-ares-gold hover:text-white uppercase tracking-widest text-xs font-bold transition-all flex items-center gap-2 mb-6 w-fit">
            <span>&larr;</span> Back to all posts
          </Link>
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
             <span className="w-fit px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/50 shadow-[0_0_15px_rgba(0,192,192,0.4)]">
               {post.date && !isNaN(new Date(post.date).getTime()) ? format(new Date(post.date), 'MMMM do, yyyy') : "Unpublished"}
             </span>
             {(post.author_avatar || post.author_nickname) && (
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 w-fit">
                 <img 
                   src={post.author_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.author_nickname || post.slug}`}
                   alt="Author"
                   className="w-6 h-6 rounded-full object-cover border border-white/20"
                 />
                 <span className="text-sm text-white">{post.author_nickname || "ARES Author"}</span>
               </div>
             )}
            {isEditor && (
              <Link 
                to={`/dashboard/blog/${post.slug}`}
                className="w-fit flex items-center gap-2 md:ml-auto px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-ares-gold/10 hover:bg-ares-gold text-ares-gold hover:text-black border border-ares-gold/30 transition-all shadow-lg backdrop-blur-sm"
              >
                <Edit2 size={14} /> Edit Post
              </Link>
            )}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tighter drop-shadow-2xl">
            {post.title}
          </h1>
        </motion.div>
      </section>

      {/* ─── BLOG CONTENT BODY ─── */}
      <div className="w-full max-w-4xl mx-auto px-6 py-12 md:py-24">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="prose prose-invert lg:prose-lg max-w-none prose-headings:text-white prose-p:text-white prose-a:text-ares-gold prose-a:focus-visible:outline-none prose-a:focus-visible:ring-2 prose-a:focus-visible:ring-ares-cyan prose-a:rounded"
        >
          <TiptapRenderer node={parsedAst} />

          {/* Comments (auth-gated) */}
          {slug && <CommentSection targetType="post" targetId={slug} />}
        </motion.article>
      </div>
    </motion.div>
  );
}
