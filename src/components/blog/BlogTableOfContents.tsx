import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Bookmark } from "lucide-react";
import { extractTableOfContents, type TocItem } from "@/lib/blogSyndication";

interface BlogTableOfContentsProps {
  content: string;
  className?: string;
  items?: TocItem[];
}

export default function BlogTableOfContents({
  content,
  className = "",
  items: precomputedItems,
}: BlogTableOfContentsProps) {
  const items = precomputedItems || extractTableOfContents(content);
  const [activeId, setActiveId] = useState<string>("");
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(true);

  useEffect(() => {
    if (
      items.length === 0 ||
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined"
    ) {
      if (items.length > 0 && !activeId && items[0]) {
        setActiveId(items[0].id);
      }
      return;
    }

    // Default to first item if available
    if (!activeId && items[0]) {
      setActiveId(items[0].id);
    }

    const observerCallback: IntersectionObserverCallback = (entries) => {
      // Find headings currently intersecting or near the top
      const visibleEntries = entries.filter((entry) => entry.isIntersecting);
      if (visibleEntries.length > 0) {
        // Pick the top visible heading
        const topEntry = visibleEntries.reduce((prev, curr) =>
          prev.boundingClientRect.top < curr.boundingClientRect.top ? prev : curr,
        );
        setActiveId(topEntry.target.id);
      }
    };

    const observer = new IntersectionObserver(observerCallback, {
      rootMargin: "-80px 0% -60% 0%",
      threshold: [0, 0.5, 1],
    });

    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items, activeId]);

  if (items.length === 0) {
    return null;
  }

  const handleHeadingClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    e.preventDefault();
    setActiveId(id);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `#${id}`);
      }
    }
  };

  return (
    <nav
      aria-label="Table of contents"
      className={`glass-card ares-cut rounded-lg border border-white/10 bg-black/40 p-5 shadow-xl backdrop-blur-md ${className}`}
    >
      {/* Header with mobile accordion toggle */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Bookmark size={16} className="text-ares-gold" aria-hidden="true" />
          <h2 className="text-xs font-black uppercase tracking-widest text-white font-heading">
            Table of Contents
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setIsOpenMobile((prev) => !prev)}
          className="lg:hidden p-1 text-marble/70 hover:text-white transition-colors"
          aria-expanded={isOpenMobile}
          aria-label={isOpenMobile ? "Collapse Table of Contents" : "Expand Table of Contents"}
        >
          {isOpenMobile ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Heading List */}
      <ul
        className={`mt-4 space-y-1 overflow-y-auto max-h-[calc(100vh-14rem)] pr-1 transition-all ${
          isOpenMobile ? "block" : "hidden lg:block"
        }`}
      >
        {items.map((item) => {
          const isActive = activeId === item.id;
          const indentClass =
            item.level === 3 ? "pl-5 text-xs" : item.level === 4 ? "pl-7 text-xs" : "pl-2 text-sm font-semibold";

          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => handleHeadingClick(e, item.id)}
                aria-current={isActive ? "location" : undefined}
                className={`block py-1.5 pr-2 rounded transition-all duration-200 border-l-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan ${indentClass} ${
                  isActive
                    ? "border-ares-gold text-ares-gold font-bold bg-ares-gold/10"
                    : "border-transparent text-marble/70 hover:text-white hover:border-white/30 hover:bg-white/5"
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}