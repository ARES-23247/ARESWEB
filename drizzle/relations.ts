import { relations } from "drizzle-orm/relations";
import { user, session, account, seasons, posts, postsHistory, events, eventSignups, docs, docsFeedback, userProfiles, badges, userBadges, sponsors, sponsorMetrics, sponsorTokens, awards, outreachLogs, comments, notifications, tasks, taskAssignments, chatSessions, financeTransactions, sponsorshipPipeline, sponsorshipAssignments, simulations } from "./schema";

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	sessions: many(session),
	accounts: many(account),
	eventSignups: many(eventSignups),
	userProfiles: many(userProfiles),
	userBadges: many(userBadges),
	comments: many(comments),
	notifications: many(notifications),
	tasks: many(tasks),
	taskAssignments: many(taskAssignments),
	chatSessions: many(chatSessions),
	sponsorshipAssignments: many(sponsorshipAssignments),
	simulations: many(simulations),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const postsRelations = relations(posts, ({one}) => ({
	season: one(seasons, {
		fields: [posts.seasonId],
		references: [seasons.startYear]
	}),
}));

export const seasonsRelations = relations(seasons, ({many}) => ({
	posts: many(posts),
	postsHistories: many(postsHistory),
	events: many(events),
	awards: many(awards),
	outreachLogs: many(outreachLogs),
	financeTransactions: many(financeTransactions),
	sponsorshipPipelines: many(sponsorshipPipeline),
}));

export const postsHistoryRelations = relations(postsHistory, ({one}) => ({
	season: one(seasons, {
		fields: [postsHistory.seasonId],
		references: [seasons.startYear]
	}),
}));

export const eventsRelations = relations(events, ({one, many}) => ({
	season: one(seasons, {
		fields: [events.seasonId],
		references: [seasons.startYear]
	}),
	eventSignups: many(eventSignups),
}));

export const eventSignupsRelations = relations(eventSignups, ({one}) => ({
	user: one(user, {
		fields: [eventSignups.userId],
		references: [user.id]
	}),
	event: one(events, {
		fields: [eventSignups.eventId],
		references: [events.id]
	}),
}));

export const docsFeedbackRelations = relations(docsFeedback, ({one}) => ({
	doc: one(docs, {
		fields: [docsFeedback.slug],
		references: [docs.slug]
	}),
}));

export const docsRelations = relations(docs, ({many}) => ({
	docsFeedbacks: many(docsFeedback),
}));

export const userProfilesRelations = relations(userProfiles, ({one}) => ({
	user: one(user, {
		fields: [userProfiles.userId],
		references: [user.id]
	}),
}));

export const userBadgesRelations = relations(userBadges, ({one}) => ({
	badge: one(badges, {
		fields: [userBadges.badgeId],
		references: [badges.id]
	}),
	user: one(user, {
		fields: [userBadges.userId],
		references: [user.id]
	}),
}));

export const badgesRelations = relations(badges, ({many}) => ({
	userBadges: many(userBadges),
}));

export const sponsorMetricsRelations = relations(sponsorMetrics, ({one}) => ({
	sponsor: one(sponsors, {
		fields: [sponsorMetrics.sponsorId],
		references: [sponsors.id]
	}),
}));

export const sponsorsRelations = relations(sponsors, ({many}) => ({
	sponsorMetrics: many(sponsorMetrics),
	sponsorTokens: many(sponsorTokens),
}));

export const sponsorTokensRelations = relations(sponsorTokens, ({one}) => ({
	sponsor: one(sponsors, {
		fields: [sponsorTokens.sponsorId],
		references: [sponsors.id]
	}),
}));

export const awardsRelations = relations(awards, ({one}) => ({
	season: one(seasons, {
		fields: [awards.seasonId],
		references: [seasons.startYear]
	}),
}));

export const outreachLogsRelations = relations(outreachLogs, ({one}) => ({
	season: one(seasons, {
		fields: [outreachLogs.seasonId],
		references: [seasons.startYear]
	}),
}));

export const commentsRelations = relations(comments, ({one}) => ({
	user: one(user, {
		fields: [comments.userId],
		references: [user.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(user, {
		fields: [notifications.userId],
		references: [user.id]
	}),
}));

export const tasksRelations = relations(tasks, ({one, many}) => ({
	user: one(user, {
		fields: [tasks.createdBy],
		references: [user.id]
	}),
	taskAssignments: many(taskAssignments),
}));

export const taskAssignmentsRelations = relations(taskAssignments, ({one}) => ({
	user: one(user, {
		fields: [taskAssignments.userId],
		references: [user.id]
	}),
	task: one(tasks, {
		fields: [taskAssignments.taskId],
		references: [tasks.id]
	}),
}));

export const chatSessionsRelations = relations(chatSessions, ({one}) => ({
	user: one(user, {
		fields: [chatSessions.userId],
		references: [user.id]
	}),
}));

export const financeTransactionsRelations = relations(financeTransactions, ({one}) => ({
	season: one(seasons, {
		fields: [financeTransactions.seasonId],
		references: [seasons.startYear]
	}),
}));

export const sponsorshipPipelineRelations = relations(sponsorshipPipeline, ({one, many}) => ({
	season: one(seasons, {
		fields: [sponsorshipPipeline.seasonId],
		references: [seasons.startYear]
	}),
	sponsorshipAssignments: many(sponsorshipAssignments),
}));

export const sponsorshipAssignmentsRelations = relations(sponsorshipAssignments, ({one}) => ({
	user: one(user, {
		fields: [sponsorshipAssignments.userId],
		references: [user.id]
	}),
	sponsorshipPipeline: one(sponsorshipPipeline, {
		fields: [sponsorshipAssignments.sponsorshipId],
		references: [sponsorshipPipeline.id]
	}),
}));

export const simulationsRelations = relations(simulations, ({one}) => ({
	user: one(user, {
		fields: [simulations.authorId],
		references: [user.id]
	}),
}));