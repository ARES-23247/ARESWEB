/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DRIZZLE RELATIONS DEFINITIONS
 * ─────────────────────────────────────────────────────────────────────────────
 * Defines relationships between tables for Drizzle's relational query API.
 * Enables type-safe nested queries with automatic JOIN handling.
 */

import { relations } from 'drizzle-orm/_relations';
import type { TableRelationsHelpers } from 'drizzle-orm/_relations';
import * as schema from './schema';

// ============================================================================
// USER & AUTH RELATIONS
// ============================================================================

export const userRelations = relations(schema.user, ({ many, one }: TableRelationsHelpers<any>) => ({
  profile: one(schema.userProfiles, {
    fields: [schema.user.id],
    references: [schema.userProfiles.userId],
  }),
  sessions: many(schema.session),
  accounts: many(schema.account),
  userBadges: many(schema.userBadges),
  createdTasks: many(schema.tasks, {
    relationName: 'taskCreator',
  }),
  assignedTasks: many(schema.taskAssignments),
  comments: many(schema.comments),
  notifications: many(schema.notifications),
  eventSignups: many(schema.eventSignups),
}));

export const sessionRelations = relations(schema.session, ({ one }: TableRelationsHelpers<any>) => ({
  user: one(schema.user, {
    fields: [schema.session.userId],
    references: [schema.user.id],
  }),
}));

export const accountRelations = relations(schema.account, ({ one }: TableRelationsHelpers<any>) => ({
  user: one(schema.user, {
    fields: [schema.account.userId],
    references: [schema.user.id],
  }),
}));

// ============================================================================
// PROFILE RELATIONS
// ============================================================================

export const userProfileRelations = relations(schema.userProfiles, ({ one, many }: TableRelationsHelpers<any>) => ({
  user: one(schema.user, {
    fields: [schema.userProfiles.userId],
    references: [schema.user.id],
  }),
  badges: many(schema.userBadges),
}));

export const badgeRelations = relations(schema.badges, ({ many }: TableRelationsHelpers<any>) => ({
  userBadges: many(schema.userBadges),
}));

export const userBadgeRelations = relations(schema.userBadges, ({ one }: TableRelationsHelpers<any>) => ({
  user: one(schema.user, {
    fields: [schema.userBadges.userId],
    references: [schema.user.id],
  }),
  badge: one(schema.badges, {
    fields: [schema.userBadges.badgeId],
    references: [schema.badges.id],
  }),
}));

// ============================================================================
// CONTENT RELATIONS
// ============================================================================

export const postRelations = relations(schema.posts, ({ many, one }: TableRelationsHelpers<any>) => ({
  history: many(schema.postsHistory),
  comments: many(schema.comments),
  season: one(schema.seasons, {
    fields: [schema.posts.seasonId],
    references: [schema.seasons.startYear],
  }),
}));

export const postsHistoryRelations = relations(schema.postsHistory, ({ one }: TableRelationsHelpers<any>) => ({
  post: one(schema.posts, {
    fields: [schema.postsHistory.slug],
    references: [schema.posts.slug],
  }),
}));

export const eventRelations = relations(schema.events, ({ many }: TableRelationsHelpers<any>) => ({
  signups: many(schema.eventSignups),
}));

export const eventSignupRelations = relations(schema.eventSignups, ({ one }: TableRelationsHelpers<any>) => ({
  event: one(schema.events, {
    fields: [schema.eventSignups.eventId],
    references: [schema.events.id],
  }),
  user: one(schema.user, {
    fields: [schema.eventSignups.userId],
    references: [schema.user.id],
  }),
}));

export const docRelations = relations(schema.docs, ({ many, one }: TableRelationsHelpers<any>) => ({
  history: many(schema.docsHistory),
  feedback: many(schema.docsFeedback),
  contributors: many(schema.documentContributors),
}));

export const docsHistoryRelations = relations(schema.docsHistory, ({ one }: TableRelationsHelpers<any>) => ({
  doc: one(schema.docs, {
    fields: [schema.docsHistory.slug],
    references: [schema.docs.slug],
  }),
}));

// ============================================================================
// TASK RELATIONS
// ============================================================================

export const taskRelations = relations(schema.tasks, ({ many, one }: TableRelationsHelpers<any>) => ({
  assignments: many(schema.taskAssignments, {
    relationName: 'taskAssignments',
  }),
  creator: one(schema.user, {
    fields: [schema.tasks.createdBy],
    references: [schema.user.id],
    relationName: 'taskCreator',
  }),
}));

export const taskAssignmentRelations = relations(schema.taskAssignments, ({ one }: TableRelationsHelpers<any>) => ({
  task: one(schema.tasks, {
    fields: [schema.taskAssignments.taskId],
    references: [schema.tasks.id],
    relationName: 'taskAssignments',
  }),
  user: one(schema.user, {
    fields: [schema.taskAssignments.userId],
    references: [schema.user.id],
  }),
}));

// ============================================================================
// COMMENT RELATIONS
// ============================================================================

export const commentRelations = relations(schema.comments, ({ one }: TableRelationsHelpers<any>) => ({
  user: one(schema.user, {
    fields: [schema.comments.userId],
    references: [schema.user.id],
  }),
}));

// ============================================================================
// NOTIFICATION RELATIONS
// ============================================================================

export const notificationRelations = relations(schema.notifications, ({ one }: TableRelationsHelpers<any>) => ({
  user: one(schema.user, {
    fields: [schema.notifications.userId],
    references: [schema.user.id],
  }),
}));

// ============================================================================
// SEASON RELATIONS
// ============================================================================

export const seasonRelations = relations(schema.seasons, ({ many }: TableRelationsHelpers<any>) => ({
  posts: many(schema.posts),
  awards: many(schema.awards),
}));

// ============================================================================
// AWARD RELATIONS
// ============================================================================

export const awardRelations = relations(schema.awards, ({ one }: TableRelationsHelpers<any>) => ({
  season: one(schema.seasons, {
    fields: [schema.awards.seasonId],
    references: [schema.seasons.startYear],
  }),
}));

// ============================================================================
// DOCUMENT COLLABORATION RELATIONS
// ============================================================================

export const documentHistoryRelations = relations(schema.documentHistory, ({ one }: TableRelationsHelpers<any>) => ({
  creator: one(schema.user, {
    fields: [schema.documentHistory.createdBy],
    references: [schema.user.id],
  }),
}));

export const documentContributorRelations = relations(schema.documentContributors, ({ one }: TableRelationsHelpers<any>) => ({
  user: one(schema.user, {
    fields: [schema.documentContributors.userId],
    references: [schema.user.id],
  }),
  doc: one(schema.docs, {
    fields: [schema.documentContributors.roomId],
    references: [schema.docs.slug],
  }),
}));

export const docsFeedbackRelations = relations(schema.docsFeedback, ({ one }: TableRelationsHelpers<any>) => ({
  doc: one(schema.docs, {
    fields: [schema.docsFeedback.slug],
    references: [schema.docs.slug],
  }),
}));

// ============================================================================
// SPONSOR RELATIONS
// ============================================================================

export const sponsorRelations = relations(schema.sponsors, ({ many }: TableRelationsHelpers<any>) => ({
  metrics: many(schema.sponsorMetrics),
  tokens: many(schema.sponsorTokens),
}));

export const sponsorMetricRelations = relations(schema.sponsorMetrics, ({ one }: TableRelationsHelpers<any>) => ({
  sponsor: one(schema.sponsors, {
    fields: [schema.sponsorMetrics.sponsorId],
    references: [schema.sponsors.id],
  }),
}));

export const sponsorTokenRelations = relations(schema.sponsorTokens, ({ one }: TableRelationsHelpers<any>) => ({
  sponsor: one(schema.sponsors, {
    fields: [schema.sponsorTokens.sponsorId],
    references: [schema.sponsors.id],
  }),
}));

// ============================================================================
// LOCATION RELATIONS
// ============================================================================

export const locationRelations = relations(schema.locations, ({ many }: TableRelationsHelpers<any>) => ({
  events: many(schema.events),
}));

// ============================================================================
// INQUIRY RELATIONS
// ============================================================================

export const inquiryRelations = relations(schema.inquiries, ({ one }: TableRelationsHelpers<any>) => ({
  sponsor: one(schema.sponsors, {
    fields: [schema.inquiries.id],
    references: [schema.sponsors.id],
  }),
}));
