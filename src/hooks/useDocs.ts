import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { trackPageView } from "../utils/analytics";
import { useGetAllDocs, useGetDocWithContributors, useSearchDocs, type DocRecord } from "../api/docs";

export type { Doc, DocRecord, Contributor, DocSearchResult as SearchResult } from "../api/docs";

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

  const { data: allDocsData } = useGetAllDocs();

  const allDocs = useMemo(() => {
    if (!allDocsData?.docs) return [];
    return allDocsData.docs.filter((doc) => doc.displayInAreslib === 1);
  }, [allDocsData]);

  const { data: docWithData, isLoading: docLoading } = useGetDocWithContributors(slug || "");

  const currentDoc = docWithData?.doc;
  const contributors = docWithData?.contributors || [];

  const { data: searchRes } = useSearchDocs(searchQuery);
  const searchResults = searchRes?.results || [];

  const groupedDocs = useMemo(() => {
    const groups: Record<string, DocRecord[]> = {};
    for (const doc of allDocs) {
      if (!groups[doc.category]) groups[doc.category] = [];
      groups[doc.category].push(doc as unknown as DocRecord);
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
      navigate({ to: "/docs/$slug", params: { slug: allDocs[0].slug }, replace: true });
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

