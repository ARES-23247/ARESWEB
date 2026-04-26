/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import SEO from "../components/SEO";
import { DEFAULT_COVER_IMAGE } from "../utils/constants";
import { api } from "../api/client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface PostRecord {
  slug: string;
  title: string;
  date: string;
  snippet: string;
  thumbnail: string;
  author_nickname?: string;
  author_avatar?: string;
  cf_email?: string;
}

export default function Blog() {
  const { data: postsRes, isLoading } = api.posts.getPosts.useQuery(["posts"], {});
   
  const rawBody = (postsRes as any)?.body;
  const posts = postsRes?.status === 200 ? (Array.isArray(rawBody) ? rawBody : (Array.isArray(rawBody?.posts) ? rawBody.posts : [])) : [];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full min-h-screen bg-obsidian text-marble py-8"
    >
      <SEO title="Team Blog" description="Latest updates, engineering insights, and outreach recaps from ARES 23247." />
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-24">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <h3 className="text-ares-gold font-bold uppercase tracking-widest text-sm mb-4">Engineering & Outreach</h3>
          <h1 className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter">
            Team <span className="bg-ares-red px-6 py-2 ares-cut shadow-xl mt-2 inline-block text-white">Blog</span>.
          </h1>
          <p className="text-marble text-lg font-medium mt-4 max-w-2xl text-balance">
            Read deep dives into our codebase, mechanical design process, and reflections on our outreach events.
          </p>
        </motion.div>

        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {posts.map((post: any) => (
            <Link to={`/blog/${post.slug}`} key={post.slug} className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
              <div className="glass-card hero-card overflow-hidden cursor-pointer flex flex-col h-full border border-white/10">
                <div className="relative h-56 w-full overflow-hidden">
                  <img src={post.thumbnail || DEFAULT_COVER_IMAGE} alt={post.title} className={`w-full h-full group-hover:scale-110 transition-transform duration-700 ${post.thumbnail ? 'object-cover' : 'object-contain p-8 bg-black/80'}`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                </div>
                <div className="p-6 flex-grow flex flex-col">
                  <h4 className="text-xl font-bold text-white mb-2 group-hover:text-ares-red transition-colors">{post.title}</h4>
                  <p className="text-sm text-white/60 line-clamp-3 mb-4">{post.snippet}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
                    <p className="text-xs text-white/50">{format(new Date(post.date), 'MMMM do, yyyy')}</p>
                    {(post.author_avatar || post.author_nickname) && (
                      <div className="flex items-center gap-1.5" title={post.author_nickname}>
                        <img 
                          src={post.author_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.author_nickname || post.slug}`}
                          alt={`${post.author_nickname || "Author"}'s avatar`}
                          className="w-5 h-5 rounded-full object-cover border border-white/10"
                        />
                        <span className="text-xs uppercase tracking-wider font-bold text-ares-gold/80 truncate max-w-[100px]">{post.author_nickname || "ARES Author"}</span>
                      </div>
                    )}
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
