/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DRIZZLE + ZOD SCHEMA GENERATION
 * ─────────────────────────────────────────────────────────────────────────────
 * Auto-generates Zod schemas from Drizzle ORM table definitions.
 * Uses Drizzle ORM's native schema generation (drizzle-orm@1.0.0-beta.15+).
 *
 * IMPORTANT: The standalone drizzle-zod package is deprecated as of
 * drizzle-orm@1.0.0-beta.15. This file uses the native API instead.
 *
 * Usage:
 *   import { insertPostSchema, selectPostSchema } from '@shared/db/schema-zod';
 *
 *   // Validate API request body
 *   const parsed = insertPostSchema.parse(await req.json());
 *
 *   // Validate API response
 *   const validated = selectPostSchema.parse(dbResult);
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import * as schema from '../../src/db/schema';
import { z } from 'zod';

// ============================================================================
// USER & AUTH TABLES
// ============================================================================

export const insertUserSchema = createInsertSchema(schema.user);
export const selectUserSchema = createSelectSchema(schema.user);

export const insertSessionSchema = createInsertSchema(schema.session);
export const selectSessionSchema = createSelectSchema(schema.session);

export const insertAccountSchema = createInsertSchema(schema.account);
export const selectAccountSchema = createSelectSchema(schema.account);

export const insertVerificationSchema = createInsertSchema(schema.verification);
export const selectVerificationSchema = createSelectSchema(schema.verification);

// ============================================================================
// CONTENT TABLES (Posts, Events, Docs)
// ============================================================================

export const insertPostSchema = createInsertSchema(schema.posts);
export const selectPostSchema = createSelectSchema(schema.posts);

export const insertPostHistorySchema = createInsertSchema(schema.postsHistory);
export const selectPostHistorySchema = createSelectSchema(schema.postsHistory);

export const insertEventSchema = createInsertSchema(schema.events);
export const selectEventSchema = createSelectSchema(schema.events);

export const insertEventSignupSchema = createInsertSchema(schema.eventSignups);
export const selectEventSignupSchema = createSelectSchema(schema.eventSignups);

export const insertDocSchema = createInsertSchema(schema.docs);
export const selectDocSchema = createSelectSchema(schema.docs);

export const insertDocHistorySchema = createInsertSchema(schema.docsHistory);
export const selectDocHistorySchema = createSelectSchema(schema.docsHistory);

// ============================================================================
// DOCUMENT COLLABORATION TABLES
// ============================================================================

export const insertDocumentHistorySchema = createInsertSchema(schema.documentHistory);
export const selectDocumentHistorySchema = createSelectSchema(schema.documentHistory);

export const insertDocumentContributorSchema = createInsertSchema(schema.documentContributors);
export const selectDocumentContributorSchema = createSelectSchema(schema.documentContributors);

export const insertDocsFeedbackSchema = createInsertSchema(schema.docsFeedback);
export const selectDocsFeedbackSchema = createSelectSchema(schema.docsFeedback);

// ============================================================================
// USER PROFILE TABLES
// ============================================================================

export const insertUserProfileSchema = createInsertSchema(schema.userProfiles);
export const selectUserProfileSchema = createSelectSchema(schema.userProfiles);

export const insertBadgeSchema = createInsertSchema(schema.badges);
export const selectBadgeSchema = createSelectSchema(schema.badges);

export const insertUserBadgeSchema = createInsertSchema(schema.userBadges);
export const selectUserBadgeSchema = createSelectSchema(schema.userBadges);

// ============================================================================
// SPONSORSHIP TABLES
// ============================================================================

export const insertSponsorSchema = createInsertSchema(schema.sponsors);
export const selectSponsorSchema = createSelectSchema(schema.sponsors);

export const insertSponsorMetricSchema = createInsertSchema(schema.sponsorMetrics);
export const selectSponsorMetricSchema = createSelectSchema(schema.sponsorMetrics);

export const insertSponsorTokenSchema = createInsertSchema(schema.sponsorTokens);
export const selectSponsorTokenSchema = createSelectSchema(schema.sponsorTokens);

// ============================================================================
// OUTREACH & AWARDS TABLES
// ============================================================================

export const insertInquirySchema = createInsertSchema(schema.inquiries);
export const selectInquirySchema = createSelectSchema(schema.inquiries);

export const insertLocationSchema = createInsertSchema(schema.locations);
export const selectLocationSchema = createSelectSchema(schema.locations);

export const insertAwardSchema = createInsertSchema(schema.awards);
export const selectAwardSchema = createSelectSchema(schema.awards);

export const insertOutreachLogSchema = createInsertSchema(schema.outreachLogs);
export const selectOutreachLogSchema = createSelectSchema(schema.outreachLogs);

// ============================================================================
// SEASON TABLES
// ============================================================================

export const insertSeasonSchema = createInsertSchema(schema.seasons);
export const selectSeasonSchema = createSelectSchema(schema.seasons);

// ============================================================================
// TASKS TABLES
// ============================================================================

export const insertTaskSchema = createInsertSchema(schema.tasks);
export const selectTaskSchema = createSelectSchema(schema.tasks);

export const insertTaskAssignmentSchema = createInsertSchema(schema.taskAssignments);
export const selectTaskAssignmentSchema = createSelectSchema(schema.taskAssignments);

// ============================================================================
// COMMENTS & NOTIFICATIONS
// ============================================================================

export const insertCommentSchema = createInsertSchema(schema.comments);
export const selectCommentSchema = createSelectSchema(schema.comments);

export const insertNotificationSchema = createInsertSchema(schema.notifications);
export const selectNotificationSchema = createSelectSchema(schema.notifications);

// ============================================================================
// ANALYTICS & JUDGING TABLES
// ============================================================================

export const insertPageAnalyticsSchema = createInsertSchema(schema.pageAnalytics);
export const selectPageAnalyticsSchema = createSelectSchema(schema.pageAnalytics);

export const insertJudgeAccessCodeSchema = createInsertSchema(schema.judgeAccessCodes);
export const selectJudgeAccessCodeSchema = createSelectSchema(schema.judgeAccessCodes);

// ============================================================================
// SETTINGS & AUDIT TABLES
// ============================================================================

export const insertSettingSchema = createInsertSchema(schema.settings);
export const selectSettingSchema = createSelectSchema(schema.settings);

export const insertAuditLogSchema = createInsertSchema(schema.auditLog);
export const selectAuditLogSchema = createSelectSchema(schema.auditLog);

// ============================================================================
// AI & CHAT TABLES
// ============================================================================

export const insertChatSessionSchema = createInsertSchema(schema.chatSessions);
export const selectChatSessionSchema = createSelectSchema(schema.chatSessions);

// ============================================================================
// MEDIA & ASSETS TABLES
// ============================================================================

export const insertMediaTagSchema = createInsertSchema(schema.mediaTags);
export const selectMediaTagSchema = createSelectSchema(schema.mediaTags);

// ============================================================================
// COMMERCE TABLES
// ============================================================================

export const insertProductSchema = createInsertSchema(schema.products);
export const selectProductSchema = createSelectSchema(schema.products);

export const insertOrderSchema = createInsertSchema(schema.orders);
export const selectOrderSchema = createSelectSchema(schema.orders);

// ============================================================================
// RATE LIMITING TABLES
// ============================================================================

export const insertRateLimitSchema = createInsertSchema(schema.rateLimits);
export const selectRateLimitSchema = createSelectSchema(schema.rateLimits);

// ============================================================================
// ENTITY & FINANCE TABLES
// ============================================================================

export const insertEntityLinkSchema = createInsertSchema(schema.entityLinks);
export const selectEntityLinkSchema = createSelectSchema(schema.entityLinks);

export const insertFinanceTransactionSchema = createInsertSchema(schema.financeTransactions);
export const selectFinanceTransactionSchema = createSelectSchema(schema.financeTransactions);

export const insertSponsorshipPipelineSchema = createInsertSchema(schema.sponsorshipPipeline);
export const selectSponsorshipPipelineSchema = createSelectSchema(schema.sponsorshipPipeline);

export const insertSponsorshipAssignmentSchema = createInsertSchema(schema.sponsorshipAssignments);
export const selectSponsorshipAssignmentSchema = createSelectSchema(schema.sponsorshipAssignments);

// ============================================================================
// DOCUMENT SNAPSHOTS & SIMULATIONS
// ============================================================================

export const insertDocumentSnapshotSchema = createInsertSchema(schema.documentSnapshots);
export const selectDocumentSnapshotSchema = createSelectSchema(schema.documentSnapshots);

export const insertSimulationSchema = createInsertSchema(schema.simulations);
export const selectSimulationSchema = createSelectSchema(schema.simulations);

// ============================================================================
// SCOUTING TABLES
// ============================================================================

export const insertScoutingAnalysisSchema = createInsertSchema(schema.scoutingAnalyses);
export const selectScoutingAnalysisSchema = createSelectSchema(schema.scoutingAnalyses);

// ============================================================================
// EXTERNAL KNOWLEDGE TABLES
// ============================================================================

export const insertExternalKnowledgeSourceSchema = createInsertSchema(schema.externalKnowledgeSources);
export const selectExternalKnowledgeSourceSchema = createSelectSchema(schema.externalKnowledgeSources);

// ============================================================================
// PERFORMANCE METRICS TABLES
// ============================================================================

export const insertPerformanceMetricSchema = createInsertSchema(schema.performanceMetrics);
export const selectPerformanceMetricSchema = createSelectSchema(schema.performanceMetrics);

// ============================================================================
// SOCIAL QUEUE
// ============================================================================

export const insertSocialQueueSchema = createInsertSchema(schema.socialQueue);
export const selectSocialQueueSchema = createSelectSchema(schema.socialQueue);

// ============================================================================
// HELPER TYPES
// ============================================================================

// Extract TypeScript types from the generated Zod schemas
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SelectUser = z.infer<typeof selectUserSchema>;

export type InsertPost = z.infer<typeof insertPostSchema>;
export type SelectPost = z.infer<typeof selectPostSchema>;

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type SelectEvent = z.infer<typeof selectEventSchema>;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type SelectTask = z.infer<typeof selectTaskSchema>;

export type InsertSeason = z.infer<typeof insertSeasonSchema>;
export type SelectSeason = z.infer<typeof selectSeasonSchema>;
