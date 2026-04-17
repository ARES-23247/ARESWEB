"use server";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

interface ASTContent {
  type: string;
  text?: string;
  content?: ASTContent[];
}

interface ASTType {
  type: string;
  content?: ASTContent[];
}

export async function publishPostAction({
  title,
  author,
  coverImageUrl,
  ast
}: {
  title: string;
  author: string;
  coverImageUrl: string;
  ast: ASTType;
}) {
  // Safely check for development mode (process does not exist on Cloudflare Edge Worker)
  let isDev = false;
  try {
    if (typeof process !== "undefined" && typeof process.env !== "undefined") {
      if (process.env.NODE_ENV === "development") {
        isDev = true;
      }
    }
  } catch {}

  if (!isDev) {
    const h = await headers();
    
    // Prevent bypass via the unprotected .pages.dev default domain
    const host = h.get("host");
    if (host && host.includes("pages.dev")) {
      return { success: false, error: "Unauthorized: Direct access via pages.dev is restricted." };
    }

    const cfAccessEmail = h.get("cf-access-authenticated-user-email");
    if (!cfAccessEmail) {
      return { success: false, error: "Unauthorized: Cloudflare Zero Trust authentication failed. Route is protected by Cloudflare Access." };
    }
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
  
  let snippet = "Click to read more...";
  try {
    if (ast && ast.type === 'doc' && ast.content) {
      const firstParagraph = ast.content.find((n: ASTContent) => n.type === 'paragraph');
      if (firstParagraph?.content && firstParagraph.content.length > 0) {
        snippet = firstParagraph.content[0].text?.slice(0, 150) + "..." || snippet;
      }
    }
  } catch {}

  const stringifiedAst = JSON.stringify(ast);

  try {
    const { env } = getRequestContext();
    await env.DB.prepare(
      "INSERT INTO posts (slug, title, date, snippet, thumbnail, ast) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(slug, title, date, snippet, coverImageUrl, stringifiedAst).run();

    revalidatePath("/blog");
    return { success: true, slug, author }; 
  } catch (err: unknown) {
    let msg = "Failed to commit post";
    if (err instanceof Error) msg = err.message;
    console.error("Failed to insert post into D1:", err);
    return { success: false, error: msg };
  }
}
