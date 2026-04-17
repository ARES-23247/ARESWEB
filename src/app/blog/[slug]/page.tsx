import { getRequestContext } from "@cloudflare/next-on-pages";
import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";

export const runtime = "edge";

interface ASTMark {
  type: string;
}

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

  if (node.type === 'text') {
    let text: React.ReactNode = node.text;
    if (node.marks) {
      node.marks.forEach((mark: ASTMark) => {
        if (mark.type === 'bold') text = <strong key={typeof text === 'string' ? text + 'b' : 'b'}>{text}</strong>;
        if (mark.type === 'italic') text = <em key={typeof text === 'string' ? text + 'i' : 'i'}>{text}</em>;
      });
    }
    return <>{text}</>;
  }

  const children = node.content ? node.content.map((c: ASTNode, i: number) => <TiptapRenderer key={i} node={c} />) : null;

  switch (node.type) {
    case 'doc':
      return <>{children}</>;
    case 'heading':
      const level = node.attrs?.level || node.level || 1;
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      return <Tag>{children}</Tag>;
    case 'paragraph':
      return <p>{children}</p>;
    case 'bulletList':
      return <ul>{children}</ul>;
    case 'orderedList':
      return <ol>{children}</ol>;
    case 'listItem':
      return <li>{children}</li>;
    case 'image':
      const srcStr = (node.src || node.attrs?.src || '') as string;
      const altStr = (node.alt || node.attrs?.alt || '') as string;
      return (
        <figure className="my-8 rounded-xl overflow-hidden glass-card border border-white/5">
          <div className="relative w-full aspect-video">
            <Image src={srcStr} alt={altStr} fill className="object-cover" />
          </div>
          {altStr && <figcaption className="text-center text-sm text-white/50 mt-2 p-2">{altStr}</figcaption>}
        </figure>
      );
    default:
      return <>{children}</>;
  }
}

function ASTRenderer({ ast }: { ast: ASTNode | ASTNode[] }) {
  const rootNode: ASTNode = Array.isArray(ast) ? { type: 'doc', content: ast } : ast;
  return <TiptapRenderer node={rootNode} />;
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let post: PostRow | null = null;

  try {
    const { env } = getRequestContext();
    const db = env.DB;
    post = await db.prepare("SELECT slug, title, date, ast FROM posts WHERE slug = ?").bind(slug).first<PostRow>();
  } catch (err) {
    console.error("Local D1 might not be instantiated during build", err);
  }

  if (!post) {
    notFound();
  }

  let parsedAst: ASTNode | ASTNode[] = { type: 'doc', content: [] };
  try {
    parsedAst = JSON.parse(post.ast);
  } catch(e) {
    console.error("Failed to parse AST:", e);
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-12 md:py-24">
      <Link href="/blog" className="text-ares-cyan hover:underline text-sm mb-8 inline-block">&larr; Back to all posts</Link>
      
      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">{post.title}</h1>
        <p className="text-ares-red font-medium">{post.date}</p>
      </header>

      <article className="prose prose-invert lg:prose-lg max-w-none prose-headings:text-white prose-p:text-white/80 prose-a:text-ares-cyan">
        <ASTRenderer ast={parsedAst} />
      </article>
    </div>
  );
}
