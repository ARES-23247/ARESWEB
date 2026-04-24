import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
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

const SIDEBAR_ORDER = [
  "Getting Started",
  "Migration Guides",
  "Support",
  "Community",
  "Reference",
  "The ARESLib Standard",
  "Foundation Track",
  "Precision Track",
  "Reliability Track",
  "HMI & Control",
];

export function useDocs(slug: string | undefined) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [feedbackToken, setFeedbackToken] = useState("");

  const { data: allDocsRes } = api.docs.getDocs.useQuery({}, {
    queryKey: ["docs-list"],
  });
  const allDocs = useMemo(() => {
    const rawBody = (allDocsRes as any)?.body;
    return allDocsRes?.status === 200 ? (Array.isArray(rawBody) ? rawBody : (Array.isArray(rawBody?.docs) ? rawBody.docs : [])) : [];
  }, [allDocsRes]);

  const ObjectQuery = api.docs.getDoc.useQuery({
    params: { slug: slug || "" },
  }, {
    queryKey: ["doc", slug],
    enabled: !!slug,
  });

  const currentDoc = ObjectQuery.data?.status === 200 ? ObjectQuery.data.body.doc : undefined;
  const contributors = ObjectQuery.data?.status === 200 ? ObjectQuery.data.body.contributors : [];
  const docLoading = ObjectQuery.isLoading;

  const { data: searchRes } = api.docs.searchDocs.useQuery({
    query: { q: searchQuery },
  }, {
    queryKey: ["docs-search", searchQuery],
    enabled: searchQuery.length >= 2,
  });
  const searchResults = searchRes?.status === 200 ? searchRes.body.results : [];

  const groupedDocs = useMemo(() => {
    const groups: Record<string, DocRecord[]> = {};
    for (const doc of allDocs) {
      if (!groups[doc.category]) groups[doc.category] = [];
      groups[doc.category].push(doc);
    }
    const ordered: [string, DocRecord[]][] = [];
    for (const cat of SIDEBAR_ORDER) {
      if (groups[cat]) ordered.push([cat, groups[cat]]);
    }
    for (const [cat, docs] of Object.entries(groups)) {
      if (!SIDEBAR_ORDER.includes(cat)) ordered.push([cat, docs]);
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
      trackPageView(`/docs/${currentDoc.slug}`, 'doc');
    }
  }, [currentDoc]);

  useEffect(() => {
    if (!slug && allDocs.length > 0) {
      navigate(`/docs/${allDocs[0].slug}`, { replace: true });
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