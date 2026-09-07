import type { GardenTheme, LevelDefinition, ObjectKind } from "./level";
import type { RunReplay } from "./replay";

/** Transport contracts only. The website injects authentication and HTTP access. */
export interface CommunityMetadata {
  nickname: string;
  difficulty: "gentle" | "moderate" | "challenging";
  estimatedLength: "short" | "medium" | "long";
}
export interface CommunityParent {
  id: string;
  revision: number;
}
export interface CommunityCard extends CommunityMetadata {
  id: string;
  revision: number;
  title: string;
  theme: GardenTheme;
  mechanics: ObjectKind[];
  population: number;
  rescueTarget: number;
  objectives?: LevelDefinition["objectives"];
}
export interface CommunityGarden extends CommunityCard {
  level: LevelDefinition;
  parent?: { id: string; title: string; nickname: string };
}
export interface CommunityFilters {
  mechanic?: ObjectKind;
  difficulty?: CommunityMetadata["difficulty"];
  estimatedLength?: CommunityMetadata["estimatedLength"];
  cursor?: string;
}
export interface CommunityPage {
  gardens: CommunityCard[];
  nextCursor: string | null;
}
export interface CommunitySubmission {
  expectedVersion: number;
  metadata: CommunityMetadata;
  proof: { level: LevelDefinition; replays: RunReplay[] };
  parent?: CommunityParent;
}
export type CommunityReviewReason =
  "text" | "identity" | "unsafe" | "misleading" | "other";
export interface OwnedCommunityGarden {
  id: string;
  version: number;
  title: string;
  publishedRevision: number | null;
  candidateRevision: number | null;
  status: "pending" | "rejected" | "published" | "removed" | "deleted";
  reviewReason: CommunityReviewReason | null;
}
export interface CommunityReview {
  garden: OwnedCommunityGarden;
  candidate: CommunityCard & { level: LevelDefinition };
  reviewDigest: string;
  allBeesProven: boolean;
  bestPollen: number;
  fewestTools: number;
}
export interface OwnedCommunityRevision {
  garden: OwnedCommunityGarden;
  level: LevelDefinition;
  metadata: CommunityMetadata;
}
export interface CommunityReport {
  id: string;
  levelId: string;
  revision: number;
  reason: CommunityReviewReason;
  /** Null when the reported publication has been replaced, removed or deleted. */
  publication: { card: CommunityCard; version: number } | null;
}
export interface CommunityReportPage {
  reports: CommunityReport[];
  nextCursor: string | null;
}
export interface CommunityClient {
  browse(filters?: CommunityFilters): Promise<CommunityPage>;
  get(id: string): Promise<CommunityGarden>;
  mine(): Promise<OwnedCommunityGarden[]>;
  getOwn(id: string): Promise<OwnedCommunityRevision>;
  submit(
    id: string,
    submission: CommunitySubmission,
  ): Promise<OwnedCommunityGarden>;
  removeOwn(id: string, expectedVersion: number): Promise<OwnedCommunityGarden>;
  pending(
    cursor?: string,
  ): Promise<{ gardens: OwnedCommunityGarden[]; nextCursor: string | null }>;
  review(id: string): Promise<CommunityReview>;
  decide(
    id: string,
    expectedVersion: number,
    reviewDigest: string,
    decision: "approve" | "reject",
    reason?: CommunityReviewReason,
  ): Promise<OwnedCommunityGarden>;
  removePublished(
    id: string,
    expectedVersion: number,
    reason: CommunityReviewReason,
  ): Promise<OwnedCommunityGarden>;
  report(id: string, reason: CommunityReviewReason): Promise<void>;
  reports(cursor?: string): Promise<CommunityReportPage>;
  resolveReport(id: string): Promise<void>;
}
