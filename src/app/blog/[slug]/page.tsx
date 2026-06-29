"use client";

import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import DocsMarkdownRenderer from "@/components/docs/DocsMarkdownRenderer";
import { cleanThumbnailUrl } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import BlogManagementPage from "@/app/dashboard/blog/page";
import { Pencil } from "lucide-react";
import SEO from "@/components/SEO";
import ShareButtons from "@/components/ShareButtons";

interface BlogPostDetails {
  slug: string;
  title: string;
  date?: string;
  snippet?: string;
  thumbnail?: string;
  author?: string;
  authorAvatar?: string;
  content: string;
}

const MOCK_DETAILS: Record<string, BlogPostDetails> = {
  "championship-2026-recap": {
    slug: "championship-2026-recap",
    title: "Championship 2026: Team ARES Wins Big!",
    date: "May 20, 2026",
    snippet: "A comprehensive recap of our journey, triumphs, and scores at the 2026 *FIRST*® World Championship.",
    author: "David Coach",
    thumbnail: "https://images.unsplash.com/photo-1561557944-6e7860d1a7eb?w=1000&auto=format&fit=crop&q=80",
    content: `We are absolutely thrilled to report that ARES 23247 has achieved a championship-grade finish at the 2026 *FIRST*® World Championship! 

Our mecanum-drivetrain powered robot, utilizing **ARESLib** EKF localizations, performed with ultimate precision on the playfield. We scored a record-breaking number of autonomous delivery cones and secured victory in our divisional finals!

### The Engineering Behind the Success
The core differentiator of this season's robot was our integration of the GoBilda Pinpoint Odometry module combined with our custom Extended Kalman Filter (EKF) algorithm. By calibrating our motor friction feedforward coefficient ($kS$) to exactly **0.05**, we overcame motor deadbands at low speeds. This resulted in near-zero autonomous pathing error throughout the entire tournament.

### Key Event Highlights
* **Autonomous Runs**: We secured a 100% success rate on our multi-cone autonomous path, yielding a massive lead in each qualification match.
* **TeleOp Coordination**: Our drive team executed field-centric Mecanum maneuvers flawlessly, navigating tight defense with swift pivot turns.
* **Community Connection**: We shared our open-source software libraries and pathing tools with dozens of visiting international teams in the pit areas, promoting *FIRST*® Core Values of Coopertition and Gracious Professionalism.

We want to express our deepest gratitude to our students, mentors, parents, and sponsors who supported us. The 2025-2026 season has been an unforgettable milestones, and we are already looking forward to next year's engineering challenge!`
  },
  "drivetrain-ekf-calibration": {
    slug: "drivetrain-ekf-calibration",
    title: "ARESLib Drivetrain & EKF Odometry Calibrations",
    date: "May 15, 2026",
    snippet: "Deep technical insight into tuning mecanum kS feedforward and GoBilda Pinpoint EKF odometry values.",
    author: "Lead Student",
    thumbnail: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1000&auto=format&fit=crop&q=80",
    content: `In modern *FIRST*® Tech Challenge robotics, precise autonomous navigation is the foundation of high scores. In this article, we share the engineering methodology behind the localization system in **ARESLib**.

### 1. Calibrating Static Friction Feedforward (kS)
Every DC motor has an internal deadband caused by static friction. To overcome this, **ARESLib** implements a feedforward model where:
$$\\text{Voltage} = kS \\cdot \\text{sign}(\\text{Velocity}) + kV \\cdot \\text{Velocity} + kA \\cdot \\text{Acceleration}$$

During field tests, we noticed low-speed motor stalling. By performing a systematic sweep, we calibrated $kS$ to **0.05**. This small voltage offset instantly kicks in to overcome friction, allowing our Mecanum wheels to execute micro-adjustments perfectly.

### 2. Tuning the GoBilda Pinpoint Odometry EKF
The GoBilda Pinpoint system provides high-speed hardware-accelerated odometry ticks. However, wheel slippage can accumulate error. **ARESLib** addresses this by blending mechanical encoder counts with IMU gyro heading coordinates inside an Extended Kalman Filter (EKF).

This sensor fusion guarantees that even if a defense robot shoves us sideways, our estimated field coordinate remains accurate within **0.8 cm**, ensuring our auto-scoring path is never derailed.

### Summary Code Sample
For field-centric driving, stick vectors are rotated by the current gyro heading:
\`\`\`kotlin
fun driveFieldCentric(y: Double, x: Double, rx: Double, heading: Double) {
    val rotX = x * Math.cos(-heading) - y * Math.sin(-heading)
    val rotY = x * Math.sin(-heading) + y * Math.cos(-heading)
    
    // Apply power to mecanum motors with static friction compensation
    leftFront.power = rotY + rotX + rx + (0.05 * Math.signum(rotY + rotX + rx))
    // Repeat for other motors...
}
\`\`\`

If you have questions about implementing this on your robot, feel free to reach out to us at aresfirst.org or ask in our Zulip server!`
  }
};

export default function BlogPostPage() {
  const { user, authorizedUser } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Editor Drawer States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorAction, setEditorAction] = useState<"create" | "edit" | null>(null);
  const [editorSlug, setEditorSlug] = useState<string | null>(null);

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  const handleOpenInlineEdit = () => {
    setEditorAction("edit");
    setEditorSlug(slug || null);
    setIsEditorOpen(true);
  };

  useEffect(() => {
    if (!slug) return;

    const docRef = doc(db, "posts", slug);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          setPost(MOCK_DETAILS[slug] || null);
          setIsLoading(false);
          return;
        }

        const data = docSnap.data();
        if (!data || data.isDeleted === 1 || data.status !== "published") {
          setPost(MOCK_DETAILS[slug] || null);
          setIsLoading(false);
          return;
        }

        setPost({
          slug,
          title: data.title || "Untitled Post",
          date: data.date || "",
          snippet: data.snippet || "",
          thumbnail: data.thumbnail || "",
          author: data.author || "ARES Member",
          authorAvatar: data.authorAvatar || "",
          content: data.content || data.snippet || ""
        });
        setIsLoading(false);
      },
      (error) => {
        console.warn("Firestore read failed for post slug: using mock fallback.", { slug, error });
        setPost(MOCK_DETAILS[slug] || null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-obsidian text-marble">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-ares-red"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-obsidian text-marble p-6">
        <h2 className="text-3xl font-black uppercase text-white tracking-widest font-heading mb-4">Post Not Found</h2>
        <p className="text-marble/60 text-sm mb-8">The blog article you are looking for does not exist or has been removed.</p>
        <Link to="/blog" className="clipped-button bg-ares-red text-white uppercase text-xs">
          Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble">
      <SEO 
        title={post.title} 
        description={post.snippet || `Read "${post.title}" by ${post.author || "ARES Member"} on the ARES 23247 team blog.`}
        image={post.thumbnail}
        type="article"
        schemaData={{
          authorName: post.author || "ARES Member",
          datePublished: (() => {
            if (!post.date) return undefined;
            const parsed = Date.parse(post.date);
            return isNaN(parsed) ? undefined : new Date(parsed).toISOString();
          })()
        }}
      />
      {/* ─── STANDALONE BLOG HERO ─── */}
      <section className="relative w-full h-[50vh] min-h-[400px] flex items-center overflow-hidden bg-obsidian border-b-4 border-ares-cyan">
        <img
          src={cleanThumbnailUrl(post.thumbnail || "/favicon.png")}
          alt={post.title}
          className={(post.thumbnail && post.thumbnail !== "/favicon.png") ? "absolute inset-0 w-full h-full opacity-60 mix-blend-luminosity object-cover" : "absolute inset-0 m-auto w-32 h-32 opacity-25 mix-blend-luminosity object-contain"}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/70 to-transparent"></div>
        
        {/* Motif: Glowing orb overlay */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vh] h-[80vh] rounded-full border border-ares-cyan/10 shadow-[0_0_120px_rgba(0,192,192,0.15)] pointer-events-none mix-blend-screen animate-pulse" aria-hidden="true"></div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-6 w-full mt-16">
          <Link to="/blog" className="text-ares-gold hover:text-white uppercase tracking-widest text-xs font-bold transition-all flex items-center gap-2 mb-6 w-fit">
            <span>&larr;</span> Back to all posts
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="w-fit px-4 py-1.5 ares-cut-sm text-xs font-bold uppercase tracking-widest bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/50 shadow-[0_0_15px_rgba(0,192,192,0.4)]">
                {post.date}
              </span>
              <div className="flex items-center gap-2 px-3 py-1.5 ares-cut-sm bg-white/5 border border-white/10 w-fit">
                <img 
                  src={
                    post.authorAvatar
                      ? (post.authorAvatar.startsWith("http") || post.authorAvatar.includes("/")
                          ? post.authorAvatar
                          : `https://api.dicebear.com/7.x/bottts/svg?seed=${post.authorAvatar}`)
                      : `https://api.dicebear.com/7.x/bottts/svg?seed=${post.author || post.slug}`
                  }
                  alt=""
                  className="w-6 h-6 rounded-full object-cover border border-white/20"
                />
                <span className="text-sm text-white">{post.author || "ARES Member"}</span>
              </div>
            </div>
            {canEdit && (
              <button
                onClick={handleOpenInlineEdit}
                className="clipped-button bg-ares-gold/20 hover:bg-ares-gold/30 border border-ares-gold/40 text-ares-gold font-bold text-xs uppercase tracking-widest py-2 px-4 flex items-center gap-2 cursor-pointer shadow-lg transition-all active:scale-95 z-20"
              >
                <Pencil size={12} /> Edit Blog Post
              </button>
            )}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tighter drop-shadow-2xl mb-4 font-heading">
            {post.title}
          </h1>
        </div>
      </section>

      {/* ─── BLOG CONTENT BODY ─── */}
      <div className="w-full max-w-4xl mx-auto px-6 pt-16 pb-8 md:pt-24 md:pb-12">
        <article className="prose prose-invert lg:prose-lg max-w-none prose-headings:text-white prose-p:text-white/90 prose-a:text-ares-gold prose-a:focus-visible:outline-none prose-a:focus-visible:ring-2 prose-a:focus-visible:ring-ares-cyan prose-a:rounded leading-relaxed">
          <DocsMarkdownRenderer content={post.content} />
        </article>
      </div>

      {/* ─── SHARE SECTION ─── */}
      <div className="w-full max-w-4xl mx-auto px-6 pb-16">
        <ShareButtons title={post.title} theme="gold" />
      </div>

      {/* ─── UPGRADED FULL BLOG EDITOR DRAWER ─── */}
      {isEditorOpen && (
        <BlogManagementPage
          editorOnly={true}
          prefilledAction={editorAction}
          prefilledSlug={editorSlug}
          onEditorClose={() => {
            setIsEditorOpen(false);
            setEditorAction(null);
            setEditorSlug(null);
          }}
        />
      )}
    </div>
  );
}
