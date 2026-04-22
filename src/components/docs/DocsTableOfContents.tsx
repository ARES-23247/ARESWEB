import { memo, useState, useEffect, useMemo } from "react";

interface TocHeading {
  level: number;
  text: string;
  id: string;
}

interface DocsTableOfContentsProps {
  content?: string;
}

function DocsTableOfContents({ content }: DocsTableOfContentsProps) {
  const [activeId, setActiveId] = useState("");

  const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const tableOfContents = useMemo<TocHeading[]>(() => {
    if (!content) return [];
    
    // Check if it's Tiptap JSON
    try {
      const trimmed = content.trim();
      if (trimmed.startsWith("{")) {
        const parsed = JSON.parse(trimmed);
        if (parsed.type === "doc" && parsed.content) {
          const headings: TocHeading[] = [];
          const findHeadings = (node: { type?: string; attrs?: { level?: number }; content?: { text?: string }[] }) => {
            if (node.type === "heading" && (node.attrs?.level === 2 || node.attrs?.level === 3)) {
              const text = node.content?.map((c) => c.text || "").join("") || "";
              const cleanText = stripHtml(text);
              const id = cleanText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              headings.push({ level: node.attrs.level, text: cleanText, id });
            }
            if (node.content && Array.isArray(node.content)) {
              // @ts-expect-error -- recursive AST walk
              node.content.forEach(c => findHeadings(c));
            }
          };
          findHeadings(parsed);
          return headings;
        }
      }
    } catch {
      // Not JSON, treat as Markdown
    }

    const headings = Array.from(content.matchAll(/^(#{2,3})\s+(.+)$/gm));
    return headings.map((match) => {
      const level = match[1].length;
      const text = stripHtml(match[2].trim());
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return { level, text, id };
    });
  }, [content]);

  // Intersection Observer for scroll sync
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "0% 0% -80% 0%" }
    );

    const headings = document.querySelectorAll("h2[id], h3[id]");
    headings.forEach((h) => observer.observe(h));

    return () => observer.disconnect();
  }, [content]);

  if (tableOfContents.length === 0) return null;

  return (
    <aside className="hidden xl:block w-64 shrink-0 pt-24 px-6 pb-8 sticky right-0 top-0 h-screen overflow-y-auto">
      <h3 className="text-white/60 font-bold mb-4 font-heading tracking-wide uppercase text-xs">On this page</h3>
      <nav className="flex flex-col gap-3 border-l border-white/10 pl-4">
        {tableOfContents.map((heading, i) => (
          <a 
            key={i} 
            href={`#${heading.id}`}
            className={`text-sm transition-all duration-200 hover:text-ares-gold focus-visible:outline-none focus:text-ares-gold ${
              heading.level === 3 ? "pl-4" : "font-medium"
            } ${
              activeId === heading.id 
                ? "text-ares-gold translate-x-1" 
                : (heading.level === 3 ? "text-white/60" : "text-white/70")
            }`}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </aside>
  );
}

export default memo(DocsTableOfContents);
