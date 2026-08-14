"use client";

import { logger } from "@/utils/logger";
import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  collection,
  query,
  where,
  onSnapshot,
  limit,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebaseFirestore";
import { useAuth } from "@/context/AuthContext";
import BlogManagementPage from "@/app/dashboard/blog/page";
import { Pencil, Plus, Clock, Rss, Radio, Layers } from "lucide-react";
import SEO from "@/components/SEO";
import BlogThumbnailImage from "@/components/BlogThumbnailImage";
import { PublicDataState } from "@/components/PublicDataState";
import {
  BLOG_CATEGORIES,
  calculateReadingTime,
  filterPostsByCategory,
} from "@/lib/blogSyndication";

export interface BlogPost {
  slug: string;
  title: string;
  date?: string;
  snippet?: string;
  content?: string;
  thumbnail?: string;
  author?: string;
  authorAvatar?: string;
  category?: string;
}

export default function BlogFeedPage() {
  const { user, authorizedUser } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Editor Drawer States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorAction, setEditorAction] = useState<"create" | "edit" | null>(
    null,
  );
  const [editorSlug, setEditorSlug] = useState<string | null>(null);

  const canEdit = !!(
    user &&
    authorizedUser &&
    authorizedUser.role !== "unverified"
  );

  const handleOpenInlineCreate = () => {
    setEditorAction("create");
    setEditorSlug(null);
    setIsEditorOpen(true);
  };

  const handleOpenInlineEdit = (slug: string) => {
    setEditorAction("edit");
    setEditorSlug(slug);
    setIsEditorOpen(true);
  };

  useEffect(() => {
    const q = query(
      collection(db, "posts"),
      where("status", "==", "published"),
      where("isDeleted", "==", 0),
      orderBy("date", "desc"),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const postsList = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            slug: doc.id,
            title: data.title || "Untitled Post",
            date: data.date || "",
            snippet: data.snippet || "",
            content: data.content || "",
            thumbnail: data.thumbnail || "",
            author: data.author || "ARES Member",
            authorAvatar: data.authorAvatar || "",
            category: data.category || "Engineering",
          };
        });
        setPosts(postsList);
        setLoadError(null);
        setIsLoading(false);
      },
      (error) => {
        logger.error("Unable to load published blog posts:", error);
        setPosts([]);
        setLoadError(error.message);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const filteredPosts = useMemo(
    () => filterPostsByCategory(posts, selectedCategory),
    [posts, selectedCategory],
  );

  // Category counts for chips
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: posts.length };
    BLOG_CATEGORIES.forEach((cat) => {
      if (cat !== "All") {
        counts[cat] = posts.filter(
          (p) => p.category?.toLowerCase() === cat.toLowerCase(),
        ).length;
      }
    });
    return counts;
  }, [posts]);

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO
        title="Blog"
        description="Deep technical insight, mechanical design updates, code breakdowns, and outreach reflections from ARES 23247 robotics team."
      />
      {/* RSS 2.0 & Atom Feed Discovery in Head */}
      <Helmet>
        <link
          rel="alternate"
          type="application/rss+xml"
          title="ARES 23247 Team Blog (RSS 2.0)"
          href="/rss.xml"
        />
        <link
          rel="alternate"
          type="application/atom+xml"
          title="ARES 23247 Team Blog (Atom)"
          href="/atom.xml"
        />
      </Helmet>

      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-20">
        <div className="mb-12 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          <div>
            <p className="text-ares-gold font-bold uppercase tracking-widest text-sm mb-4">
              Engineering & Outreach
            </p>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter">
              Team{" "}
              <span className="bg-ares-red px-6 py-2 ares-cut shadow-xl mt-2 inline-block text-white font-bold">
                Blog
              </span>
              .
            </h1>
            <p className="text-marble/85 text-lg font-medium mt-4 max-w-2xl text-balance">
              Read deep dives into our codebase, mechanical design process, and
              reflections on our outreach events.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Feed Discovery Actions */}
            <a
              href="/rss.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="clipped-button bg-white/5 hover:bg-white/10 text-ares-gold border border-white/10 hover:border-ares-gold/40 text-xs font-bold uppercase tracking-wider py-3 px-4 inline-flex items-center gap-2 transition-all cursor-pointer shadow"
              title="Subscribe via RSS 2.0"
              aria-label="Subscribe to RSS 2.0 feed"
            >
              <Rss size={14} className="text-ares-gold" />
              <span>RSS</span>
            </a>

            <a
              href="/atom.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="clipped-button bg-white/5 hover:bg-white/10 text-ares-cyan border border-white/10 hover:border-ares-cyan/40 text-xs font-bold uppercase tracking-wider py-3 px-4 inline-flex items-center gap-2 transition-all cursor-pointer shadow"
              title="Subscribe via Atom Feed"
              aria-label="Subscribe to Atom feed"
            >
              <Radio size={14} className="text-ares-cyan" />
              <span>Atom</span>
            </a>

            {canEdit && (
              <button
                onClick={handleOpenInlineCreate}
                className="clipped-button bg-ares-red text-white hover:bg-ares-bronze font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl shrink-0"
              >
                <Plus size={16} /> New Blog Post
              </button>
            )}
          </div>
        </div>

        {/* ─── CATEGORY TAXONOMY FILTER CHIPS ─── */}
        <section
          aria-label="Filter blog posts by category"
          className="mb-10 pb-6 border-b border-white/10"
        >
          <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-marble/60">
            <Layers size={14} className="text-ares-gold" aria-hidden="true" />
            <span>Filter by Category:</span>
          </div>

          <div
            role="group"
            aria-label="Category taxonomy filter"
            className="flex flex-wrap items-center gap-2"
          >
            {BLOG_CATEGORIES.map((category) => {
              const isActive = selectedCategory === category;
              const count = categoryCounts[category] ?? 0;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  aria-pressed={isActive}
                  className={`ares-cut-sm px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                    isActive
                      ? "bg-ares-red text-white border border-ares-red shadow-[0_0_15px_rgba(192,0,0,0.35)] scale-105"
                      : "bg-white/5 text-marble/70 hover:text-white hover:bg-white/10 border border-white/10 hover:border-white/25"
                  }`}
                >
                  <span>{category}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? "bg-black/30 text-white font-black"
                        : "bg-white/10 text-marble/60"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-ares-red"></div>
          </div>
        ) : loadError ? (
          <PublicDataState
            title="Unable to load the team blog"
            message="The published articles could not be reached. Check your connection and try again."
            diagnostic={loadError}
            onRetry={() => window.location.reload()}
          />
        ) : posts.length === 0 ? (
          <section className="hero-card border border-white/10 bg-black/20 p-12 text-center">
            <h2 className="text-xl font-black text-white">
              No published articles yet
            </h2>
            <p className="mt-2 text-sm text-marble/70">
              New engineering and outreach stories will appear here.
            </p>
          </section>
        ) : filteredPosts.length === 0 ? (
          <section className="hero-card border border-white/10 bg-black/20 p-12 text-center">
            <h2 className="text-xl font-black text-white">
              No articles found in "{selectedCategory}"
            </h2>
            <p className="mt-2 text-sm text-marble/70 mb-6">
              There are currently no published stories under this category.
            </p>
            <button
              type="button"
              onClick={() => setSelectedCategory("All")}
              className="ares-cut px-5 py-2 bg-ares-gold/20 hover:bg-ares-gold/30 text-ares-gold border border-ares-gold/40 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              Show all articles
            </button>
          </section>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post) => {
              const readingTime = calculateReadingTime(
                post.content || post.snippet || post.title,
              );

              return (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <div className="glass-card hero-card overflow-hidden cursor-pointer flex flex-col h-full border border-white/10 hover:border-ares-gold/40 transition-colors">
                    <div className="relative h-56 w-full overflow-hidden bg-black/30 flex items-center justify-center border-b border-white/5">
                      <BlogThumbnailImage
                        title={post.title}
                        thumbnail={post.thumbnail}
                        author={post.author}
                        date={post.date}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent animate-fadeIn"></div>

                      {/* Category Badge on Thumbnail */}
                      {post.category && (
                        <div className="absolute top-4 left-4 z-10">
                          <span className="px-2.5 py-1 ares-cut-sm text-[10px] font-black uppercase tracking-wider bg-black/70 text-ares-gold border border-ares-gold/40 backdrop-blur-md">
                            {post.category}
                          </span>
                        </div>
                      )}

                      {canEdit && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleOpenInlineEdit(post.slug);
                          }}
                          className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-ares-gold/80 border border-white/10 rounded-lg transition-all text-white cursor-pointer z-10 hover:scale-105 active:scale-95 shadow-lg"
                          title="Edit Article"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                    </div>
                    <div className="p-6 flex-grow flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2 text-xs text-marble/60">
                          <span>{post.date}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-ares-gold/80 font-medium">
                            <Clock size={11} /> {readingTime.text}
                          </span>
                        </div>
                        <h4 className="text-xl font-bold text-white mb-2 group-hover:text-ares-red-light transition-colors">
                          {post.title}
                        </h4>
                        <p className="text-sm text-white/60 line-clamp-3 mb-4">
                          {post.snippet}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                        <div className="flex items-center gap-1.5">
                          <img
                            src={
                              post.authorAvatar
                                ? post.authorAvatar.startsWith("http") ||
                                  post.authorAvatar.includes("/")
                                  ? post.authorAvatar
                                  : `https://api.dicebear.com/7.x/bottts/svg?seed=${post.authorAvatar}`
                                : `https://api.dicebear.com/7.x/bottts/svg?seed=${post.author || post.slug}`
                            }
                            alt=""
                            className="w-5 h-5 rounded-full object-cover border border-white/10"
                          />
                          <span className="text-xs uppercase tracking-wider font-bold text-ares-gold/80 truncate max-w-[120px]">
                            {post.author}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-ares-cyan group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                          Read &rarr;
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
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