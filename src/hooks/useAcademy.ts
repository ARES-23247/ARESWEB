import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { trackPageView } from "../utils/analytics";
import { useGetAllDocs, useGetDocWithContributors, useSearchDocs, type DocRecord } from "../api/docs";

const ACADEMY_SIDEBAR_ORDER = [
  "AI 101",
  "Neural Networks",
  "Machine Vision",
  "Reinforcement Learning",
  "Generative AI",
  "Physics",
  "Mathematics"
];

export interface SearchResult {
  slug: string;
  title: string;
  category: string;
  snippet: string;
}

export function useAcademy(slug: string | undefined) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [feedbackToken, setFeedbackToken] = useState("");

  const { data: rawAllDocs } = useGetAllDocs();

  const allDocs = useMemo(() => {
    if (!rawAllDocs?.docs) return [];
    return rawAllDocs.docs.filter((doc: DocRecord) => doc.display_in_math_corner === 1 || doc.display_in_science_corner === 1);
  }, [rawAllDocs]);

  const ObjectQuery = useGetDocWithContributors(slug || "");

  const currentDoc = ObjectQuery.data?.doc;
  const contributors = ObjectQuery.data?.contributors || [];
  const docLoading = ObjectQuery.isLoading;

  const { data: searchResponse } = useSearchDocs(searchQuery);
  const searchResults = searchResponse?.results || [];

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
