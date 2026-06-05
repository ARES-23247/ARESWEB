import React, { ReactNode } from "react";
import { Info, AlertTriangle, Lightbulb } from "lucide-react";

export interface ASTMark {
  type: string;
  attrs?: Record<string, string | number | boolean>;
}

export interface ASTNode {
  type: string;
  text?: string;
  content?: ASTNode[];
  level?: number;
  marks?: ASTMark[];
  src?: string;
  alt?: string;
  attrs?: Record<string, string | number | boolean>;
}

const renderText = (node: ASTNode) => {
  let text: ReactNode = node.text || "";
  if (!node.marks || !Array.isArray(node.marks)) return text;

  // We copy the marks array and process it
  node.marks.forEach((mark) => {
    if (mark.type === "bold") {
      text = <strong key={typeof text === "string" ? text + "-b" : "b"}>{text}</strong>;
    }
    if (mark.type === "italic") {
      text = <em key={typeof text === "string" ? text + "-i" : "i"}>{text}</em>;
    }
    if (mark.type === "strike") {
      text = <s key={typeof text === "string" ? text + "-s" : "s"}>{text}</s>;
    }
    if (mark.type === "underline") {
      text = <u key={typeof text === "string" ? text + "-u" : "u"}>{text}</u>;
    }
    if (mark.type === "code") {
      text = (
        <code
          key={typeof text === "string" ? text + "-c" : "c"}
          className="bg-white/10 px-1.5 py-0.5 rounded text-ares-cyan text-xs font-mono"
        >
          {text}
        </code>
      );
    }
    if (mark.type === "link") {
      const href = (mark.attrs?.href as string) || "#";
      text = (
        <a
          key={typeof text === "string" ? text + "-link" : "link"}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ares-gold underline decoration-ares-gold/40 underline-offset-2 hover:text-ares-cyan hover:decoration-ares-cyan transition-colors"
        >
          {text}
        </a>
      );
    }
  });
  return text;
};

const renderHeading = (node: ASTNode, children: ReactNode) => {
  const level = node.attrs?.level || node.level || 1;
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

  let className = "font-heading font-bold mb-4 text-white border-b border-white/10 pb-2";
  if (level === 1) className = "text-3xl " + className + " mt-8";
  if (level === 2) className = "text-2xl font-bold font-heading mt-6 mb-3 text-ares-gold border-none pb-0";
  if (level === 3) className = "text-xl font-bold font-heading mt-5 mb-2 text-ares-red border-none pb-0";
  if (level === 4) className = "text-lg font-bold font-heading mt-4 mb-2 text-white border-none pb-0";

  return <Tag className={className}>{children}</Tag>;
};

const renderCallout = (node: ASTNode, children: ReactNode) => {
  const type = node.attrs?.type || "info";
  let bgClass = "bg-ares-cyan/10 border-ares-cyan/30 text-white";
  let icon = <Info className="text-ares-cyan" size={18} />;

  if (type === "warning") {
    bgClass = "bg-ares-red/10 border-ares-red/30 text-white";
    icon = <AlertTriangle className="text-ares-red" size={18} />;
  } else if (type === "tip") {
    bgClass = "bg-ares-gold/10 border-ares-gold/30 text-white";
    icon = <Lightbulb className="text-ares-gold" size={18} />;
  }

  return (
    <div className={`p-4 my-6 rounded-lg border flex gap-3 ${bgClass}`}>
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 text-sm leading-relaxed">{children}</div>
    </div>
  );
};

export default function TiptapRenderer({ node }: { node: ASTNode }) {
  if (!node) return null;

  if (node.type === "text") {
    return <>{renderText(node)}</>;
  }

  const children =
    node.content && Array.isArray(node.content)
      ? node.content.map((c, i) => <TiptapRenderer key={i} node={c} />)
      : null;

  switch (node.type) {
    case "doc":
      return <>{children}</>;
    case "heading":
      return renderHeading(node, children);
    case "paragraph":
      return <p className="text-marble/90 leading-relaxed mb-4 text-sm md:text-base">{children || <br />}</p>;
    case "bulletList":
      return <ul className="list-disc list-inside space-y-1 mb-4 text-marble/80 ml-4">{children}</ul>;
    case "orderedList":
      return <ol className="list-decimal list-inside space-y-1 mb-4 text-marble/80 ml-4">{children}</ol>;
    case "listItem":
      return <li className="leading-relaxed text-sm md:text-base">{children}</li>;
    case "blockquote":
      return (
        <blockquote className="border-l-4 border-ares-red/60 bg-ares-red/5 px-4 py-3 my-4 text-white italic font-medium rounded-r-md">
          {children}
        </blockquote>
      );
    case "table":
      return (
        <div className="overflow-x-auto my-6">
          <table className="w-full text-left border-collapse border border-white/10 rounded-lg shadow-lg table-auto text-sm">
            <tbody>{children}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr className="border-b border-white/5 odd:bg-black/20 even:bg-black/45">{children}</tr>;
    case "tableHeader":
      return <th className="bg-obsidian border border-white/10 p-3 font-bold text-ares-gold whitespace-nowrap uppercase tracking-wider text-xs">{children}</th>;
    case "tableCell":
      return <td className="border border-white/5 p-3 text-marble/90 align-top">{children}</td>;
    case "callout":
      return renderCallout(node, children);
    case "horizontalRule":
      return <hr className="my-6 border-t border-white/10" />;
    default:
      return <>{children}</>;
  }
}
