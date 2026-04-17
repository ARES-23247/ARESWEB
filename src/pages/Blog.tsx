import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface PostRecord {
  slug: string;
  title: string;
  date: string;
  snippet: string;
  thumbnail: string;
}

export default function Blog() {
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/posts")
      .then((r) => r.json())
      .then((data) => { setPosts(data.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-24">
      <div className="mb-12">
        <h3 className="text-ares-cyan font-bold uppercase tracking-widest text-sm mb-2">Engineering &amp; Outreach</h3>
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter shadow-sm">
          Team <span className="text-ares-red">Blog</span>
        </h1>
        <p className="text-white/60 mt-4 max-w-2xl text-balance">
          Read deep dives into our codebase, mechanical design process, and reflections on our outreach events.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.map((post) => (
          <Link to={`/blog/${post.slug}`} key={post.slug} className="block group">
            <div className="glass-card rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(220,38,38,0.15)] flex flex-col h-full border border-white/10 group-hover:border-ares-red/30">
              <div className="relative h-56 w-full overflow-hidden">
                <img src={post.thumbnail} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <p className="text-xs text-white/50 mb-2">{post.date}</p>
                <h4 className="text-xl font-bold text-white mb-3 group-hover:text-ares-red transition-colors">{post.title}</h4>
                <p className="text-sm text-white/60 line-clamp-3">{post.snippet}</p>
              </div>
            </div>
          </Link>
        ))}
        {!loading && posts.length === 0 && (
          <div className="text-white/50 p-6 glass-card rounded-2xl col-span-full border-dashed">
            No posts published yet. Head to the <Link to="/dashboard" className="text-ares-cyan hover:underline">Dashboard</Link> to create one.
          </div>
        )}
        {loading && (
          <div className="text-white/50 p-6 glass-card rounded-2xl col-span-full animate-pulse">
            Loading posts from D1...
          </div>
        )}
      </div>
    </div>
  );
}
