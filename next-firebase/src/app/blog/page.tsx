import Link from "next/link";
import { adminDb } from "@/lib/firebase-admin";

interface BlogPost {
  slug: string;
  title: string;
  date?: string;
  snippet?: string;
  thumbnail?: string;
  author?: string;
}

// Revalidate statically generated page at most every hour (ISR)
export const revalidate = 3600;

const MOCK_POSTS: BlogPost[] = [
  {
    slug: "championship-2026-recap",
    title: "Championship 2026: Team ARES Wins Big!",
    date: "May 20, 2026",
    snippet: "A comprehensive recap of our journey, triumphs, and scores at the 2026 FIRST® World Championship.",
    author: "David Coach",
    thumbnail: "https://images.unsplash.com/photo-1561557944-6e7860d1a7eb?w=500&auto=format&fit=crop&q=60"
  },
  {
    slug: "drivetrain-ekf-calibration",
    title: "ARESLib Drivetrain & EKF Odometry Calibrations",
    date: "May 15, 2026",
    snippet: "Deep technical insight into tuning mecanum kS feedforward and GoBilda Pinpoint EKF odometry values.",
    author: "Lead Student",
    thumbnail: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=500&auto=format&fit=crop&q=60"
  }
];

async function getBlogPosts(): Promise<BlogPost[]> {
  try {
    const snapshot = await adminDb
      .collection("posts")
      .where("status", "==", "published")
      .where("isDeleted", "==", 0)
      .get();

    if (snapshot.empty) {
      return MOCK_POSTS;
    }

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        slug: doc.id,
        title: data.title || "Untitled Post",
        date: data.date || "",
        snippet: data.snippet || "",
        thumbnail: data.thumbnail || "",
        author: data.author || "ARES Member"
      };
    });
  } catch (error) {
    console.warn("Firestore empty or not connected during compilation, using mock articles:", error);
    return MOCK_POSTS;
  }
}

export default async function BlogFeedPage() {
  const posts = await getBlogPosts();

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-20">
        <div className="mb-12">
          <p className="text-ares-gold font-bold uppercase tracking-widest text-sm mb-4">
            Engineering & Outreach
          </p>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter">
            Team <span className="bg-ares-red px-6 py-2 ares-cut shadow-xl mt-2 inline-block text-white font-bold">Blog</span>.
          </h1>
          <p className="text-marble/85 text-lg font-medium mt-4 max-w-2xl text-balance">
            Read deep dives into our codebase, mechanical design process, and reflections on our outreach events.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <div className="glass-card hero-card overflow-hidden cursor-pointer flex flex-col h-full border border-white/10">
                {post.thumbnail && (
                  <div className="relative h-56 w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.thumbnail}
                      alt={post.title}
                      className="w-full h-full group-hover:scale-105 transition-transform duration-500 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                  </div>
                )}
                <div className="p-6 flex-grow flex flex-col justify-between">
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2 group-hover:text-ares-red transition-colors">
                      {post.title}
                    </h4>
                    <p className="text-sm text-white/60 line-clamp-3 mb-4">
                      {post.snippet}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                    <p className="text-xs text-white/50">{post.date}</p>
                    <div className="flex items-center gap-1.5">
                      <img
                        src={`https://api.dicebear.com/7.x/bottts/svg?seed=${post.author || post.slug}`}
                        alt=""
                        className="w-5 h-5 rounded-full object-cover border border-white/10"
                      />
                      <span className="text-xs uppercase tracking-wider font-bold text-ares-gold/80 truncate max-w-[120px]">
                        {post.author}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          
          {posts.length === 0 && (
            <div className="text-white p-6 glass-card hero-card col-span-full border-dashed">
              No posts published yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
