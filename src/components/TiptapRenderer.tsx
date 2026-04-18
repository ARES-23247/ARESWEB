import type { ReactNode } from "react";

export interface ASTMark { type: string; }
export interface ASTNode {
  type: string;
  text?: string;
  content?: ASTNode[];
  level?: number;
  marks?: ASTMark[];
  src?: string;
  alt?: string;
  attrs?: Record<string, string | number>;
}

export default function TiptapRenderer({ node }: { node: ASTNode }) {
  if (!node) return null;

  if (node.type === "text") {
    let text: ReactNode = node.text;
    if (node.marks) {
      node.marks.forEach((mark) => {
        if (mark.type === "bold") text = <strong key={typeof text === "string" ? text + "b" : "b"}>{text}</strong>;
        if (mark.type === "italic") text = <em key={typeof text === "string" ? text + "i" : "i"}>{text}</em>;
      });
    }
    return <>{text}</>;
  }

  const children = node.content ? node.content.map((c, i) => <TiptapRenderer key={i} node={c} />) : null;

  switch (node.type) {
    case "doc": return <>{children}</>;
    case "heading": {
      const level = node.attrs?.level || node.level || 1;
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      return <Tag>{children}</Tag>;
    }
    case "paragraph": return <p>{children}</p>;
    case "bulletList": return <ul>{children}</ul>;
    case "orderedList": return <ol>{children}</ol>;
    case "listItem": return <li>{children}</li>;
    case "image": {
      const srcStr = (node.src || node.attrs?.src || "") as string;
      const altStr = (node.alt || node.attrs?.alt || "") as string;
      return (
        <figure className="my-8 rounded-xl overflow-hidden glass-card border border-white/5">
          <div className="relative w-full aspect-video">
            <img src={srcStr} alt={altStr} className="w-full h-full object-cover" />
          </div>
          {altStr && <figcaption className="text-center text-sm text-white/80 mt-2 p-2">{altStr}</figcaption>}
        </figure>
      );
    }
    default: return <>{children}</>;
  }
}
