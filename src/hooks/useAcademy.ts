import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../api";
import { useQuery } from "@tanstack/react-query";
import { trackPageView } from "../utils/analytics";

export interface DocRecord {
  slug: string;
  title: string;
  category: string;
  sort_order: number;
  description: string;
  content?: string;
  updated_at?: string;
  snippet?: string;
  cf_email?: string;
  original_author_nickname?: string;
  original_author_avatar?: string;
  display_in_areslib?: number;
  display_in_math_corner?: number;
  display_in_science_corner?: number;
}

export interface Contributor {
  author_email: string;
  nickname?: string;
  avatar?: string;
}

export interface SearchResult {
  slug: string;
  title: string;
  category: string;
  snippet: string;
}

const ACADEMY_SIDEBAR_ORDER = [
  "AI 101",
  "Neural Networks",
  "Machine Vision",
  "Reinforcement Learning",
  "Generative AI",
  "Physics",
  "Mathematics"
];

export function useAcademy(slug: string | undefined) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [feedbackToken, setFeedbackToken] = useState("");

  const { data: rawAllDocs } = useQuery({
    queryKey: ["docs-list"],
    queryFn: () => fetchJson<{ docs: DocRecord[] }>("/api/docs")
  });
  
  const allDocs = useMemo(() => {
    if (!rawAllDocs?.docs) return [];
    return rawAllDocs.docs.filter((doc: DocRecord) => doc.display_in_math_corner === 1 || doc.display_in_science_corner === 1);
  }, [rawAllDocs]);

  const ObjectQuery = useQuery({
    queryKey: ["doc", slug],
    queryFn: () => fetchJson<{ doc: DocRecord, contributors: Contributor[] }>(`/api/docs/${slug}`),
    enabled: !!slug
  });

  const currentDoc = ObjectQuery.data?.doc;
  const contributors = ObjectQuery.data?.contributors || [];
  const docLoading = ObjectQuery.isLoading;

  const { data: rawSearch } = useQuery({
    queryKey: ["docs-search", searchQuery],
    queryFn: () => fetchJson<{ results: SearchResult[] }>(`/api/docs/search?q=${encodeURIComponent(searchQuery)}`),
    enabled: searchQuery.length >= 2
  });
  const searchResults = rawSearch?.results || [];

  const groupedDocs = useMemo(() => {
    const groups: Record<string, DocRecord[]> = {};
    for (const doc of allDocs) {
      if (!groups[doc.category]) groups[doc.category] = [];
      groups[doc.category].push(doc);
    }
    const ordered: [string, DocRecord[]][] = [];
    for (const cat of ACADEMY_SIDEBAR_ORDER) {
      if (groups[cat]) ordered.push([cat, groups[cat]]);
    }
    for (const [cat, docs] of Object.entries(groups)) {
      if (!ACADEMY_SIDEBAR_ORDER.includes(cat)) ordered.push([cat, docs]);
    }
    return ordered;
  }, [allDocs]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (currentDoc) {
      trackPageView(`/academy/${currentDoc.slug}`, 'doc');
    }
  }, [currentDoc]);

  useEffect(() => {
    if (!slug && allDocs.length > 0) {
      navigate(`/academy/${allDocs[0].slug}`, { replace: true });
    }
  }, [slug, allDocs, navigate]);

  return {
    allDocs,
    currentDoc,
    contributors,
    docLoading,
    searchResults,
    groupedDocs,
    searchQuery,
    setSearchQuery,
    searchOpen,
    setSearchOpen,
    feedbackToken,
    setFeedbackToken,
  };
}