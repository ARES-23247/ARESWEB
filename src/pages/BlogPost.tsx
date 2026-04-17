import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

interface ASTMark { type: string; }
interface ASTNode {
  type: string;
  text?: string;
  content?: ASTNode[];
  level?: number;
  marks?: ASTMark[];
  src?: string;
  alt?: string;
  attrs?: Record<string, string | number>;
}

interface PostRow {
  slug: string;
  title: string;
  date: string;
  ast: string;
}

function TiptapRenderer({ node }: { node: ASTNode }) {
  if (!node) return null;

  if (node.type === "text") {
    let text: React.ReactNode = node.text;
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
          {altStr && <figcaption className="text-center text-sm text-white/50 mt-2 p-2">{altStr}</figcaption>}
        </figure>
      );
    }
    default: return <>{children}</>;
  }
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<PostRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/posts/${slug}`)
      .then((r) => { if (!r.ok) { setNotFound(true); setLoading(false); return null; } return r.json(); })
      .then((data) => { if (data) { setPost(data.post); } setLoading(false); })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  if (loading) return <div className="w-full max-w-4xl mx-auto px-6 py-24 text-white/50 animate-pulse">Loading post...</div>;
  if (notFound || !post) return <div className="w-full max-w-4xl mx-auto px-6 py-24 text-white/50">Post not found.</div>;

  let parsedAst: ASTNode = { type: "doc", content: [] };
  try { parsedAst = JSON.parse(post.ast); } catch {}

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-12 md:py-24">
      <Link to="/blog" className="text-ares-cyan hover:underline text-sm mb-8 inline-block">&larr; Back to all posts</Link>
      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">{post.title}</h1>
        <p className="text-ares-red font-medium">{post.date}</p>
      </header>
      <article className="prose prose-invert lg:prose-lg max-w-none prose-headings:text-white prose-p:text-white/80 prose-a:text-ares-cyan">
        <TiptapRenderer node={parsedAst} />
      </article>
    </div>
  );
}
