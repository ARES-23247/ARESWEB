import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { format } from "date-fns";
import SEO from "../components/SEO";
import { DEFAULT_coverImage } from "../utils/constants";
import { useGetPosts, type Post as _Post } from "../api";

interface PostRecord {
  slug: string;
  title: string;
  date?: string | null;
  snippet?: string | null;
  thumbnail?: string | null;
  authorNickname?: string | null;
  authorAvatar?: string | null;
  cf_email?: string;
}

export default function Blog() {
  const { data: postsRes, isLoading } = useGetPosts();

  const posts = postsRes?.posts || [];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full min-h-screen bg-obsidian text-marble py-8"
    >
      <SEO title="Team Blog" description="Latest updates, engineering insights, and outreach recaps from ARES 23247." />
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-24">
        <div className="mb-20">
          <div className="bg-ares-gold/10 text-ares-gold px-6 py-2 ares-cut-sm font-black uppercase tracking-[0.4em] text-[10px] mb-8 border border-ares-gold/20 inline-block">
             Field Log // Engineering
          </div>
          <h1 className="text-5xl md:text-8xl font-black text-white uppercase tracking-tighter leading-none mb-8">
            Team <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-marble/20">Blog</span>
          </h1>
          <p className="text-marble/40 text-xl max-w-2xl font-medium leading-relaxed">
            Read deep dives into our codebase, mechanical design process, and reflections on our outreach events.
          </p>
        </div>

        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {posts.map((post: PostRecord) => (
            <Link to="/blog/$slug" params={{ slug: post.slug }} key={post.slug} className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan h-full">
              <div className="bg-black/40 border border-white/5 ares-cut-lg overflow-hidden cursor-pointer flex flex-col h-full transition-all duration-700 hover:border-ares-red/30 hover:shadow-[0_20px_40px_rgba(192,0,0,0.15)] backdrop-blur-sm">
                <div className="relative h-64 w-full overflow-hidden bg-black/60">
                  <img 
                    src={post.thumbnail || DEFAULT_coverImage} 
                    alt={post.title} 
                    className={`w-full h-full group-hover:scale-110 transition-transform duration-1000 ${post.thumbnail ? 'object-cover' : 'object-contain p-12 opacity-20'}`} 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
                  <div className="absolute bottom-6 left-6">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-ares-red bg-ares-red/10 border border-ares-red/20 px-3 py-1 ares-cut-sm backdrop-blur-md">
                      {post.date ? format(new Date(post.date), 'MMM yyyy') : 'Recent'}
                    </span>
                  </div>
                </div>
                <div className="p-8 flex-grow flex flex-col">
                  <h4 className="text-xl font-black text-white mb-4 group-hover:text-ares-red transition-colors uppercase tracking-tighter leading-tight line-clamp-2">{post.title}</h4>
                  <p className="text-marble/40 text-sm font-medium line-clamp-3 mb-8 leading-relaxed">{post.snippet}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-6 border-t border-white/5">
                    {(post.authorAvatar || post.authorNickname) && (
                      <div className="flex items-center gap-3" title={post.authorNickname ?? undefined}>
                        <img
                          src={post.authorAvatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${post.authorNickname || post.slug}`}
                          alt={`${post.authorNickname || "Author"}'s avatar`}
                          className="w-6 h-6 ares-cut border border-white/10 object-cover"
                        />
                        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-marble/60 truncate max-w-[120px]">{post.authorNickname || "ARES Author"}</span>
                      </div>
                    )}
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 group-hover:text-ares-red transition-colors flex items-center gap-2">
                       Read More <span className="text-lg">→</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          {!isLoading && posts.length === 0 && (
            <div className="text-white p-6 glass-card hero-card col-span-full border-dashed">
              No posts published yet. Head to the <Link to="/dashboard" className="text-ares-gold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">Dashboard</Link> to create one.
            </div>
          )}
          {isLoading && (
            <div className="flex justify-center items-center py-20 col-span-full">
              <div className="w-12 h-12 border-4 border-ares-red/30 border-t-ares-red rounded-full animate-spin"></div>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}


