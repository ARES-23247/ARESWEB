// @ts-expect-error - relations function exists in drizzle-orm v1.0.0-beta but types may be incorrect
import { relations } from "drizzle-orm";
import { user, session, account, seasons, posts, postsHistory, events, eventSignups, docs, docsHistory, docsFeedback, userProfiles, badges, userBadges, sponsors, sponsorMetrics, sponsorTokens, awards, outreachLogs, comments, notifications, tasks, taskAssignments, chatSessions, financeTransactions, sponsorshipPipeline, sponsorshipAssignments, simulations, products, orders, entityLinks, documentHistory, documentContributors, documentSnapshots } from "./schema";

// The 'one' and 'many' callback parameters are typed by Drizzle ORM but TypeScript
// doesn't always infer them correctly. We use 'any' to work around this limitation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sessionRelations = relations(session, ({ one }: any) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
		relationName: "session_user",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const userRelations = relations(user, ({ many }: any) => ({
	sessions: many(session, { relationName: "session_user" }),
	accounts: many(account, { relationName: "account_user" }),
	eventSignups: many(eventSignups, { relationName: "event_signup_user" }),
	userProfiles: many(userProfiles, { relationName: "user_profile_user" }),
	userBadges: many(userBadges, { relationName: "user_badge_user" }),
	comments: many(comments, { relationName: "comment_user" }),
	notifications: many(notifications, { relationName: "notification_user" }),
	tasks: many(tasks, { relationName: "task_user" }),
	taskAssignments: many(taskAssignments, { relationName: "task_assignment_user" }),
	chatSessions: many(chatSessions, { relationName: "chat_session_user" }),
	sponsorshipAssignments: many(sponsorshipAssignments, { relationName: "sponsorship_assignment_user" }),
	simulations: many(simulations, { relationName: "simulation_author" }),
	documentContributors: many(documentContributors, { relationName: "document_contributor_user" }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const accountRelations = relations(account, ({ one }: any) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
		relationName: "account_user",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const postsRelations = relations(posts, ({ one, many }: any) => ({
	season: one(seasons, {
		fields: [posts.seasonId],
		references: [seasons.startYear],
		relationName: "post_season",
	}),
	histories: many(postsHistory, { relationName: "post_history_post" }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const seasonsRelations = relations(seasons, ({ many }: any) => ({
	posts: many(posts, { relationName: "post_season" }),
	postsHistories: many(postsHistory, { relationName: "post_history_season" }),
	events: many(events, { relationName: "event_season" }),
	awards: many(awards, { relationName: "award_season" }),
	outreachLogs: many(outreachLogs, { relationName: "outreach_log_season" }),
	financeTransactions: many(financeTransactions, { relationName: "finance_transaction_season" }),
	sponsorshipPipelines: many(sponsorshipPipeline, { relationName: "sponsorship_pipeline_season" }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const postsHistoryRelations = relations(postsHistory, ({ one }: any) => ({
	post: one(posts, {
		fields: [postsHistory.slug],
		references: [posts.slug],
		relationName: "post_history_post",
	}),
	season: one(seasons, {
		fields: [postsHistory.seasonId],
		references: [seasons.startYear],
		relationName: "post_history_season",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const eventsRelations = relations(events, ({ one, many }: any) => ({
	season: one(seasons, {
		fields: [events.seasonId],
		references: [seasons.startYear],
		relationName: "event_season",
	}),
	eventSignups: many(eventSignups, { relationName: "event_signup_event" }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const eventSignupsRelations = relations(eventSignups, ({ one }: any) => ({
	user: one(user, {
		fields: [eventSignups.userId],
		references: [user.id],
		relationName: "event_signup_user",
	}),
	event: one(events, {
		fields: [eventSignups.eventId],
		references: [events.id],
		relationName: "event_signup_event",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const docsFeedbackRelations = relations(docsFeedback, ({ one }: any) => ({
	doc: one(docs, {
		fields: [docsFeedback.slug],
		references: [docs.slug],
		relationName: "docs_feedback_doc",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const docsHistoryRelations = relations(docsHistory, ({ one }: any) => ({
	doc: one(docs, {
		fields: [docsHistory.slug],
		references: [docs.slug],
		relationName: "docs_history_doc",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const docsRelations = relations(docs, ({ many }: any) => ({
	docsFeedbacks: many(docsFeedback, { relationName: "docs_feedback_doc" }),
	histories: many(docsHistory, { relationName: "docs_history_doc" }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const userProfilesRelations = relations(userProfiles, ({ one }: any) => ({
	user: one(user, {
		fields: [userProfiles.userId],
		references: [user.id],
		relationName: "user_profile_user",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const userBadgesRelations = relations(userBadges, ({ one }: any) => ({
	badge: one(badges, {
		fields: [userBadges.badgeId],
		references: [badges.id],
		relationName: "user_badge_badge",
	}),
	user: one(user, {
		fields: [userBadges.userId],
		references: [user.id],
		relationName: "user_badge_user",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const badgesRelations = relations(badges, ({ many }: any) => ({
	userBadges: many(userBadges, { relationName: "user_badge_badge" }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sponsorMetricsRelations = relations(sponsorMetrics, ({ one }: any) => ({
	sponsor: one(sponsors, {
		fields: [sponsorMetrics.sponsorId],
		references: [sponsors.id],
		relationName: "sponsor_metric_sponsor",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sponsorsRelations = relations(sponsors, ({ many }: any) => ({
	sponsorMetrics: many(sponsorMetrics, { relationName: "sponsor_metric_sponsor" }),
	sponsorTokens: many(sponsorTokens, { relationName: "sponsor_token_sponsor" }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sponsorTokensRelations = relations(sponsorTokens, ({ one }: any) => ({
	sponsor: one(sponsors, {
		fields: [sponsorTokens.sponsorId],
		references: [sponsors.id],
		relationName: "sponsor_token_sponsor",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const awardsRelations = relations(awards, ({ one }: any) => ({
	season: one(seasons, {
		fields: [awards.seasonId],
		references: [seasons.startYear],
		relationName: "award_season",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const outreachLogsRelations = relations(outreachLogs, ({ one }: any) => ({
	season: one(seasons, {
		fields: [outreachLogs.seasonId],
		references: [seasons.startYear],
		relationName: "outreach_log_season",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const commentsRelations = relations(comments, ({ one }: any) => ({
	user: one(user, {
		fields: [comments.userId],
		references: [user.id],
		relationName: "comment_user",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const notificationsRelations = relations(notifications, ({ one }: any) => ({
	user: one(user, {
		fields: [notifications.userId],
		references: [user.id],
		relationName: "notification_user",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tasksRelations = relations(tasks, ({ one, many }: any) => ({
	user: one(user, {
		fields: [tasks.createdBy],
		references: [user.id],
		relationName: "task_user",
	}),
	taskAssignments: many(taskAssignments, { relationName: "task_assignment_task" }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const taskAssignmentsRelations = relations(taskAssignments, ({ one }: any) => ({
	user: one(user, {
		fields: [taskAssignments.userId],
		references: [user.id],
		relationName: "task_assignment_user",
	}),
	task: one(tasks, {
		fields: [taskAssignments.taskId],
		references: [tasks.id],
		relationName: "task_assignment_task",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const chatSessionsRelations = relations(chatSessions, ({ one }: any) => ({
	user: one(user, {
		fields: [chatSessions.userId],
		references: [user.id],
		relationName: "chat_session_user",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const financeTransactionsRelations = relations(financeTransactions, ({ one }: any) => ({
	season: one(seasons, {
		fields: [financeTransactions.seasonId],
		references: [seasons.startYear],
		relationName: "finance_transaction_season",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sponsorshipPipelineRelations = relations(sponsorshipPipeline, ({ one, many }: any) => ({
	season: one(seasons, {
		fields: [sponsorshipPipeline.seasonId],
		references: [seasons.startYear],
		relationName: "sponsorship_pipeline_season",
	}),
	assignments: many(sponsorshipAssignments, { relationName: "sponsorship_assignment_pipeline" }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sponsorshipAssignmentsRelations = relations(sponsorshipAssignments, ({ one, _many }: any) => ({
	sponsorship: one(sponsorshipPipeline, {
		fields: [sponsorshipAssignments.sponsorshipId],
		references: [sponsorshipPipeline.id],
		relationName: "sponsorship_assignment_pipeline",
	}),
	user: one(user, {
		fields: [sponsorshipAssignments.userId],
		references: [user.id],
		relationName: "sponsorship_assignment_user",
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const simulationsRelations = relations(simulations, ({ one }: any) => ({
	user: one(user, {
		fields: [simulations.authorId],
		references: [user.id],
		relationName: "simulation_author",
	}),
}));

// Note: products and orders have no direct foreign key relationship in the schema
// Orders track customer email but not product ID directly
export const productsRelations = relations(products, () => ({
	// No relations defined - orders doesn't have a productId column
}));

export const ordersRelations = relations(orders, () => ({
	// No relations defined - orders doesn't have userId or productId columns
}));

// Note: verification table has no userId column - it uses identifier for email/phone
// Removed verificationRelations as there's no user relation

// Note: inquiries table has no userId column
// Removed inquiriesRelations as there's no user relation

// Note: locations table has no parentId column
// Removed locationsRelations as there's no self-referential relation

// Note: pageAnalytics has no docSlug column
// Removed pageAnalyticsRelations as there's no doc relation

// Note: mediaTags has no userId or parentId column
// Removed mediaTagsRelations as there are no user or parent relations

// Note: judgeAccessCodes has no userId column
// Removed judgeAccessCodesRelations as there's no user relation

// Note: entityLinks has parentId - it references itself
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const entityLinksRelations = relations(entityLinks, ({ one, _many }: any) => ({
	parent: one(entityLinks, {
		fields: [entityLinks.id],
		references: [entityLinks.id],
		relationName: "entity_link_parent",
	}),
	// Note: The relation structure here is unclear - entityLinks has sourceType/sourceId and
	// targetType/targetId for dynamic linking, not a traditional parent/child relationship
}));

// Note: documentHistory has roomId, not documentId
// The roomId likely corresponds to a docs.slug (docs are used as collaborative documents)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const documentHistoryRelations = relations(documentHistory, ({ many }: any) => ({
	// No direct relation - roomId is a string identifier that may map to docs.slug
	snapshots: many(documentSnapshots, { relationName: "document_snapshot_history" }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const documentContributorsRelations = relations(documentContributors, ({ one }: any) => ({
	user: one(user, {
		fields: [documentContributors.userId],
		references: [user.id],
		relationName: "document_contributor_user",
	}),
}));

export const documentSnapshotsRelations = relations(documentSnapshots, () => ({
	// Note: documentSnapshots.roomId references documentHistory.roomId
	// But there's no explicit foreign key in the schema
}));
