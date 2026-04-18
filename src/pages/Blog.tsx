import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import SEO from "../components/SEO";

interface PostRecord {
  slug: string;
  title: string;
  date: string;
  snippet: string;
  thumbnail: string;
}

export default function Blog() {
  const { data: posts = [], isLoading } = useQuery<PostRecord[]>({
    queryKey: ["posts"],
    queryFn: async () => {
      const r = await fetch("/api/posts");
      const data = await r.json();
      return data.posts ?? [];
    },
  });

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
          <h3 className="text-ares-gold font-bold uppercase tracking-widest text-sm mb-2">Engineering & Outreach</h3>
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tighter shadow-sm">
            Team <span className="text-ares-red">Blog</span>
          </h1>
          <p className="text-white/60 mt-4 max-w-2xl text-balance">
            Read deep dives into our codebase, mechanical design process, and reflections on our outreach events.
          </p>
        </motion.div>

        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {posts.map((post) => (
            <Link to={`/blog/${post.slug}`} key={post.slug} className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
              <div className="glass-card hero-card overflow-hidden cursor-pointer flex flex-col h-full border border-white/10">
                <div className="relative h-56 w-full overflow-hidden">
                  <img src={post.thumbnail} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                </div>
                <div className="p-6 flex-grow flex flex-col">
                  <p className="text-xs text-white/80 mb-2">{format(new Date(post.date), 'MMMM do, yyyy')}</p>
                  <h4 className="text-xl font-bold text-white mb-3 group-hover:text-ares-red transition-colors">{post.title}</h4>
                  <p className="text-sm text-white/60 line-clamp-3">{post.snippet}</p>
                </div>
              </div>
            </Link>
          ))}
          {!isLoading && posts.length === 0 && (
            <div className="text-white/80 p-6 glass-card hero-card col-span-full border-dashed">
              No posts published yet. Head to the <Link to="/dashboard" className="text-ares-gold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">Dashboard</Link> to create one.
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
