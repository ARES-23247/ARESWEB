export interface PublicBlogPost {
  slug: string;
  title: string;
  date?: string;
  snippet?: string;
  thumbnail?: string;
  author?: string;
  authorAvatar?: string;
  content?: string;
}

import type { LearningMetadata } from "@/lib/learningContent";

export interface PublicDocument extends LearningMetadata {
  slug: string;
  title: string;
  category: string;
  sortOrder: number;
  description: string;
  content?: string;
  status: string;
  isDeleted: number;
  isPortfolio: number;
  isExecutiveSummary: number;
  displayInAreslib: number;
  displayInMathCorner: number;
  displayInScienceCorner: number;
  updatedAt?: string;
  original_authorNickname?: string;
  original_authorAvatar?: string;
}

export interface PublicSeason {
  id: string;
  startYear: number;
  endYear: number | null;
  challengeName: string;
  robotName?: string | null;
  robotImage?: string | null;
  robotDescription?: string | null;
  robotCadUrl?: string | null;
  summary?: string | null;
  albumUrl?: string | null;
  albumCover?: string | null;
  status: string;
}

export interface PublicAward {
  id: string;
  title: string;
  eventName: string;
  date: string;
  description?: string | null;
  iconType: string;
  seasonId?: string | null;
  status: string;
}

export class PublicContentApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PublicContentApiError";
  }
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json() as { error?: unknown };
      detail = typeof payload.error === "string" ? payload.error : "";
    } catch {
      // The bounded status remains actionable when an intermediary returns HTML.
    }
    throw new PublicContentApiError(
      response.status,
      detail || `Public content request failed with HTTP ${response.status}.`,
    );
  }
  return await response.json() as T;
}

export async function fetchPublicBlogPosts(): Promise<PublicBlogPost[]> {
  return (await requestJson<{ posts: PublicBlogPost[] }>("/api/content/posts")).posts;
}

export async function fetchPublicBlogPost(slug: string): Promise<PublicBlogPost> {
  return (await requestJson<{ post: PublicBlogPost }>(
    `/api/content/posts/${encodeURIComponent(slug)}`,
  )).post;
}

export async function fetchPublicDocuments(
  library: "academy" | "areslib",
): Promise<PublicDocument[]> {
  return (await requestJson<{ documents: PublicDocument[] }>(
    `/api/content/docs?library=${library}`,
  )).documents;
}

export async function fetchPublicDocument(
  slug: string,
  library: "academy" | "areslib",
): Promise<PublicDocument> {
  return (await requestJson<{ document: PublicDocument }>(
    `/api/content/docs/${encodeURIComponent(slug)}?library=${library}`,
  )).document;
}

export async function fetchPublicSeasons(): Promise<PublicSeason[]> {
  return (await requestJson<{ seasons: PublicSeason[] }>("/api/seasons")).seasons;
}

export async function fetchPublicAwards(): Promise<PublicAward[]> {
  return (await requestJson<{ awards: PublicAward[] }>("/api/awards")).awards;
}
