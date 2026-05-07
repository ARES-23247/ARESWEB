import { sqliteTable, index, text, integer, real, blob, primaryKey } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const user = sqliteTable("user", {
	id: text().primaryKey(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: real().notNull(),
	image: text(),
	createdAt: integer().notNull(),
	updatedAt: integer().notNull(),
	role: text().default("user"),
	twoFactorEnabled: integer().default(0),
	twoFactorSecret: text(),
	twoFactorBackupCodes: text(),
},
(table) => [
	index("idx_user_role").on(table.role),
	index("idx_user_email").on(table.email),
]);

export const session = sqliteTable("session", {
	id: text().primaryKey(),
	expiresAt: integer().notNull(),
	token: text().notNull(),
	createdAt: integer().notNull(),
	updatedAt: integer().notNull(),
	ipAddress: text(),
	userAgent: text(),
	userId: text().notNull().references(() => user.id, { onDelete: "cascade" } ),
},
(table) => [
	index("idx_session_userId").on(table.userId),
]);

export const account = sqliteTable("account", {
	id: text().primaryKey(),
	accountId: text().notNull(),
	providerId: text().notNull(),
	userId: text().notNull().references(() => user.id, { onDelete: "cascade" } ),
	accessToken: text(),
	refreshToken: text(),
	idToken: text(),
	accessTokenExpiresAt: integer(),
	refreshTokenExpiresAt: integer(),
	scope: text(),
	password: text(),
	createdAt: integer().notNull(),
	updatedAt: integer().notNull(),
},
(table) => [
	index("idx_account_userId").on(table.userId),
]);

export const verification = sqliteTable("verification", {
	id: text().primaryKey(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: integer().notNull(),
	createdAt: integer(),
	updatedAt: integer(),
});

export const posts = sqliteTable("posts", {
	slug: text().primaryKey(),
	title: text().notNull(),
	date: text(),
	snippet: text(),
	thumbnail: text(),
	author: text(),
	cfEmail: text("cf_email"),
	ast: text().notNull(),
	contentDraft: text("content_draft"),
	isDeleted: integer("is_deleted").default(0),
	status: text().default("published"),
	revisionOf: text("revision_of"),
	publishedAt: text("published_at"),
	isPortfolio: integer("is_portfolio").default(0),
	seasonId: integer("season_id").references(() => seasons.startYear, { onDelete: "set null" } ),
	updatedAt: text("updated_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_posts_published_at").on(table.publishedAt, table.status, table.isDeleted),
	index("idx_posts_cf_email").on(table.cfEmail),
	index("idx_posts_author").on(table.author),
	index("idx_posts_status").on(table.status, table.isDeleted),
	index("idx_posts_date").on(table.date),
	index("idx_posts_season").on(table.seasonId),
]);

export const postsHistory = sqliteTable("posts_history", {
	id: integer().primaryKey({ autoIncrement: true }),
	slug: text().notNull(),
	title: text().notNull(),
	author: text(),
	thumbnail: text(),
	snippet: text(),
	ast: text().notNull(),
	authorEmail: text("author_email"),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
	seasonId: integer("season_id").references(() => seasons.startYear, { onDelete: "set null" } ),
},
(table) => [
	index("idx_posts_history_season").on(table.seasonId),
	index("idx_posts_history_slug").on(table.slug),
]);

export const events = sqliteTable("events", {
	id: text().primaryKey(),
	title: text().notNull(),
	dateStart: text("date_start").notNull(),
	dateEnd: text("date_end"),
	location: text(),
	description: text(),
	contentDraft: text("content_draft"),
	coverImage: text("cover_image"),
	gcalEventId: text("gcal_event_id"),
	tbaEventKey: text("tba_event_key"),
	isDeleted: integer("is_deleted").default(0),
	status: text().default("published"),
	category: text().default("internal"),
	isPotluck: integer("is_potluck").default(0),
	isVolunteer: integer("is_volunteer").default(0),
	revisionOf: text("revision_of"),
	publishedAt: text("published_at"),
	meetingNotes: text("meeting_notes"),
	seasonId: integer("season_id").references(() => seasons.startYear, { onDelete: "set null" } ),
	updatedAt: text("updated_at"),
},
(table) => [
	index("idx_events_category").on(table.category),
	index("idx_events_visibility").on(table.isDeleted, table.status, table.publishedAt, table.dateStart),
	index("idx_events_date").on(table.dateStart),
	index("idx_events_status").on(table.status, table.isDeleted),
	index("idx_events_season").on(table.seasonId),
]);

export const seasons = sqliteTable("seasons", {
	startYear: integer("start_year").primaryKey(),
	endYear: integer("end_year"),
	challengeName: text("challenge_name").notNull(),
	robotName: text("robot_name"),
	robotImage: text("robot_image"),
	robotDescription: text("robot_description"),
	robotCadUrl: text("robot_cad_url"),
	summary: text(),
	albumUrl: text("album_url"),
	albumCover: text("album_cover"),
	status: text().default("published"),
	isDeleted: integer("is_deleted").default(0),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
	updatedAt: text("updated_at").default("sql`(datetime('now'))`"),
});

export const eventSignups = sqliteTable("event_signups", {
	id: integer().primaryKey({ autoIncrement: true }),
	eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" } ),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" } ),
	bringing: text(),
	notes: text(),
	prepHours: real("prep_hours"),
	attended: integer().default(0),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_signups_user").on(table.userId),
	index("idx_signups_event").on(table.eventId),
]);

export const docs = sqliteTable("docs", {
	slug: text().primaryKey(),
	title: text().notNull(),
	category: text().notNull(),
	sortOrder: integer("sort_order").default(0),
	description: text(),
	content: text().notNull(),
	contentDraft: text("content_draft"),
	cfEmail: text("cf_email"),
	updatedAt: text("updated_at").default("sql`(datetime('now'))`"),
	isDeleted: integer("is_deleted").default(0),
	status: text().default("published"),
	isPortfolio: integer("is_portfolio").default(0),
	isExecutiveSummary: integer("is_executive_summary").default(0),
	displayInAreslib: integer("display_in_areslib").default(0),
	displayInMathCorner: integer("display_in_math_corner").default(0),
	displayInScienceCorner: integer("display_in_science_corner").default(0),
	revisionOf: text("revision_of"),
},
(table) => [
	index("idx_docs_category_sort").on(table.category, table.sortOrder),
	index("idx_docs_status_deleted").on(table.status, table.isDeleted),
	index("idx_docs_category").on(table.category),
]);

export const docsHistory = sqliteTable("docs_history", {
	id: integer().primaryKey({ autoIncrement: true }),
	slug: text().notNull(),
	title: text(),
	category: text(),
	description: text(),
	content: text(),
	authorEmail: text("author_email"),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_docs_history_slug_created").on(table.slug, table.createdAt),
	index("idx_docs_history_author").on(table.authorEmail),
	index("idx_docs_history_slug").on(table.slug),
]);

export const documentHistory = sqliteTable("document_history", {
	id: integer().primaryKey({ autoIncrement: true }),
	roomId: text("room_id").notNull(),
	content: text().notNull(),
	createdBy: text("created_by"),
	createdAt: real("created_at").default(sql`(CURRENT_TIMESTAMP)`),
},
(table) => [
	index("idx_document_history_room").on(table.roomId),
]);

export const documentContributors = sqliteTable("document_contributors", {
	id: integer().primaryKey({ autoIncrement: true }),
	roomId: text("room_id").notNull(),
	userId: text("user_id").notNull(),
	userName: text("user_name").notNull(),
	userAvatar: text("user_avatar"),
	lastContributedAt: real("last_contributed_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const docsFeedback = sqliteTable("docs_feedback", {
	id: integer().primaryKey({ autoIncrement: true }),
	slug: text().notNull().references(() => docs.slug, { onDelete: "cascade" } ),
	isHelpful: integer("is_helpful"),
	comment: text(),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_docs_feedback_slug").on(table.slug),
]);

export const userProfiles = sqliteTable("user_profiles", {
	userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" } ),
	firstName: text("first_name"),
	lastName: text("last_name"),
	nickname: text(),
	phone: text(),
	contactEmail: text("contact_email"),
	showEmail: integer("show_email").default(0),
	showPhone: integer("show_phone").default(0),
	pronouns: text(),
	gradeYear: text("grade_year"),
	subteams: text().default("[]"),
	memberType: text("member_type").default("student"),
	bio: text(),
	favoriteFood: text("favorite_food"),
	dietaryRestrictions: text("dietary_restrictions"),
	favoriteFirstThing: text("favorite_first_thing"),
	funFact: text("fun_fact"),
	colleges: text().default("[]"),
	employers: text().default("[]"),
	showOnAbout: integer("show_on_about").default(1),
	favoriteRobotMechanism: text("favorite_robot_mechanism"),
	preMatchSuperstition: text("pre_match_superstition"),
	leadershipRole: text("leadership_role"),
	rookieYear: text("rookie_year"),
	tshirtSize: text("tshirt_size"),
	emergencyContactName: text("emergency_contact_name"),
	emergencyContactPhone: text("emergency_contact_phone"),
	parentsName: text("parents_name"),
	parentsEmail: text("parents_email"),
	studentsName: text("students_name"),
	studentsEmail: text("students_email"),
	updatedAt: text("updated_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_user_profiles_show_on_about").on(table.showOnAbout),
	index("idx_user_profiles_member_type").on(table.memberType),
]);

export const badges = sqliteTable("badges", {
	id: text().primaryKey(),
	name: text().notNull(),
	description: text(),
	icon: text().default("Award"),
	colorTheme: text("color_theme").default("ares-gold"),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
});

export const userBadges = sqliteTable("user_badges", {
	id: integer().primaryKey({ autoIncrement: true }),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" } ),
	badgeId: text("badge_id").notNull().references(() => badges.id, { onDelete: "cascade" } ),
	awardedBy: text("awarded_by"),
	awardedAt: text("awarded_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_user_badges_badge").on(table.badgeId),
	index("idx_user_badges_user").on(table.userId),
]);

export const sponsors = sqliteTable("sponsors", {
	id: text().primaryKey(),
	name: text().notNull(),
	tier: text().notNull(),
	logoUrl: text("logo_url"),
	websiteUrl: text("website_url"),
	isActive: integer("is_active").default(1),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
});

export const sponsorMetrics = sqliteTable("sponsor_metrics", {
	id: text().primaryKey(),
	sponsorId: text("sponsor_id").notNull().references(() => sponsors.id, { onDelete: "cascade" } ),
	yearMonth: text("year_month").notNull(),
	impressions: integer().default(0),
	clicks: integer().default(0),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_sponsor_metrics_sponsor").on(table.sponsorId),
]);

export const sponsorTokens = sqliteTable("sponsor_tokens", {
	token: text().primaryKey(),
	sponsorId: text("sponsor_id").notNull().references(() => sponsors.id, { onDelete: "cascade" } ),
	createdBy: text("created_by"),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_sponsor_tokens_sponsor").on(table.sponsorId),
]);

export const inquiries = sqliteTable("inquiries", {
	id: text().primaryKey(),
	type: text().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	metadata: text(),
	status: text().default("pending"),
	isDeleted: integer("is_deleted").default(0),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
	zulipMessageId: text("zulip_message_id"),
	notes: text(),
},
(table) => [
	index("idx_inquiries_type").on(table.type),
	index("idx_inquiries_created").on(table.createdAt),
	index("idx_inquiries_status").on(table.status),
]);

export const locations = sqliteTable("locations", {
	id: text().primaryKey(),
	name: text().notNull(),
	address: text(),
	mapsUrl: text("maps_url"),
	isDeleted: integer("is_deleted").default(0),
});

export const awards = sqliteTable("awards", {
	id: integer().primaryKey({ autoIncrement: true }),
	title: text().notNull(),
	eventName: text("event_name").notNull(),
	date: text().notNull(),
	description: text(),
	iconType: text("icon_type").default("trophy"),
	isDeleted: integer("is_deleted").default(0),
	seasonId: integer("season_id").references(() => seasons.startYear, { onDelete: "set null" } ),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_awards_date").on(table.date),
	index("idx_awards_season").on(table.seasonId),
]);

export const outreachLogs = sqliteTable("outreach_logs", {
	id: integer().primaryKey({ autoIncrement: true }),
	title: text().notNull(),
	date: text().notNull(),
	location: text(),
	hours: integer(),
	peopleReached: integer("people_reached"),
	studentsCount: integer("students_count").default(0),
	impactSummary: text("impact_summary"),
	cfEmail: text("cf_email"),
	isMentoring: integer("is_mentoring").default(0),
	mentoredTeamNumber: text("mentored_team_number"),
	metadata: text(),
	isDeleted: integer("is_deleted").default(0),
	seasonId: integer("season_id").references(() => seasons.startYear, { onDelete: "set null" } ),
	eventId: text("event_id"),
	mentorCount: integer("mentor_count").default(0),
	mentorHours: integer("mentor_hours").default(0),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_outreach_date_desc").on(table.date),
	index("idx_outreach_date").on(table.date),
	index("idx_outreach_season").on(table.seasonId),
]);

export const comments = sqliteTable("comments", {
	id: text().primaryKey(),
	targetType: text("target_type").notNull(),
	targetId: text("target_id").notNull(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" } ),
	content: text().notNull(),
	zulipMessageId: text("zulip_message_id"),
	isDeleted: integer("is_deleted").default(0),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
	updatedAt: text("updated_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_comments_is_deleted").on(table.isDeleted),
	index("idx_comments_created").on(table.createdAt),
	index("idx_comments_user").on(table.userId),
	index("idx_comments_target").on(table.targetType, table.targetId),
]);

export const notifications = sqliteTable("notifications", {
	id: text().primaryKey(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" } ),
	title: text().notNull(),
	message: text().notNull(),
	link: text(),
	priority: text().default("low"),
	isRead: integer("is_read").default(0),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_notifications_user_id").on(table.userId),
]);

export const pageAnalytics = sqliteTable("page_analytics", {
	id: integer().primaryKey({ autoIncrement: true }),
	path: text().notNull(),
	category: text().default("system"),
	referrer: text(),
	userAgent: text("user_agent"),
	timestamp: text().default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_analytics_path_time").on(table.path, table.timestamp),
	index("idx_page_analytics_timestamp").on(table.timestamp),
	index("idx_page_analytics_path").on(table.path),
]);

export const mediaTags = sqliteTable("media_tags", {
	key: text().primaryKey(),
	folder: text().default("Library"),
	tags: text(),
});

export const judgeAccessCodes = sqliteTable("judge_access_codes", {
	id: text().primaryKey(),
	code: text().notNull(),
	label: text().default("Judge Access"),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
	expiresAt: text("expires_at"),
},
(table) => [
	index("idx_judge_codes_code").on(table.code),
]);

export const settings = sqliteTable("settings", {
	key: text().primaryKey(),
	value: text().notNull(),
	updatedAt: text("updated_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_settings_key").on(table.key),
]);

export const tasks = sqliteTable("tasks", {
	id: text().primaryKey(),
	title: text().notNull(),
	description: text(),
	status: text().default("todo"),
	priority: text().default("normal"),
	subteam: text(),
	sortOrder: integer("sort_order").default(0),
	assignedTo: text("assigned_to"),
	parentId: text("parent_id"),
	timeSpentSeconds: integer("time_spent_seconds").default(0),
	createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "cascade" } ),
	dueDate: text("due_date"),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
	updatedAt: text("updated_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_tasks_sort").on(table.status, table.sortOrder),
	index("idx_tasks_status").on(table.status),
]);

export const taskAssignments = sqliteTable("task_assignments", {
	taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" } ),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" } ),
},
(table) => [
	index("idx_task_assignments_user").on(table.userId),
	primaryKey({ columns: [table.taskId, table.userId], name: "task_assignments_task_id_user_id_pk"})
]);

export const auditLog = sqliteTable("audit_log", {
	id: text().primaryKey(),
	actor: text().notNull(),
	action: text().notNull(),
	resourceType: text("resource_type").notNull(),
	resourceId: text("resource_id"),
	details: text(),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_audit_log_created_at").on(table.createdAt),
	index("idx_audit_log_action").on(table.action),
	index("idx_audit_log_actor").on(table.actor),
]);

export const docsFts = sqliteTable("docs_fts", {
	slug: real(),
	title: real(),
	category: real(),
	description: real(),
	content: real(),
	status: real(),
	isDeleted: real("is_deleted"),
	docsFts: real("docs_fts"),
	rank: real(),
});

export const docsFtsData = sqliteTable("docs_fts_data", {
	id: integer().primaryKey(),
	block: blob(),
});

export const docsFtsIdx = sqliteTable("docs_fts_idx", {
	segid: real().notNull(),
	term: real().notNull(),
	pgno: real(),
},
(table) => [
	primaryKey({ columns: [table.segid, table.term], name: "docs_fts_idx_segid_term_pk"})
]);

export const docsFtsContent = sqliteTable("docs_fts_content", {
	id: integer().primaryKey(),
	c0: real(),
	c1: real(),
	c2: real(),
	c3: real(),
	c4: real(),
	c5: real(),
	c6: real(),
});

export const docsFtsDocsize = sqliteTable("docs_fts_docsize", {
	id: integer().primaryKey(),
	sz: blob(),
});

export const docsFtsConfig = sqliteTable("docs_fts_config", {
	k: real().primaryKey().notNull(),
	v: real(),
});

export const postsFts = sqliteTable("posts_fts", {
	slug: real(),
	title: real(),
	snippet: real(),
	author: real(),
	ast: real(),
	postsFts: real("posts_fts"),
	rank: real(),
});

export const postsFtsData = sqliteTable("posts_fts_data", {
	id: integer().primaryKey(),
	block: blob(),
});

export const postsFtsIdx = sqliteTable("posts_fts_idx", {
	segid: real().notNull(),
	term: real().notNull(),
	pgno: real(),
},
(table) => [
	primaryKey({ columns: [table.segid, table.term], name: "posts_fts_idx_segid_term_pk"})
]);

export const postsFtsContent = sqliteTable("posts_fts_content", {
	id: integer().primaryKey(),
	c0: real(),
	c1: real(),
	c2: real(),
	c3: real(),
	c4: real(),
});

export const postsFtsDocsize = sqliteTable("posts_fts_docsize", {
	id: integer().primaryKey(),
	sz: blob(),
});

export const postsFtsConfig = sqliteTable("posts_fts_config", {
	k: real().primaryKey().notNull(),
	v: real(),
});

export const eventsFts = sqliteTable("events_fts", {
	id: real(),
	title: real(),
	description: real(),
	location: real(),
	status: real(),
	isDeleted: real("is_deleted"),
	eventsFts: real("events_fts"),
	rank: real(),
});

export const eventsFtsData = sqliteTable("events_fts_data", {
	id: integer().primaryKey(),
	block: blob(),
});

export const eventsFtsIdx = sqliteTable("events_fts_idx", {
	segid: real().notNull(),
	term: real().notNull(),
	pgno: real(),
},
(table) => [
	primaryKey({ columns: [table.segid, table.term], name: "events_fts_idx_segid_term_pk"})
]);

export const eventsFtsContent = sqliteTable("events_fts_content", {
	id: integer().primaryKey(),
	c0: real(),
	c1: real(),
	c2: real(),
	c3: real(),
	c4: real(),
	c5: real(),
});

export const eventsFtsDocsize = sqliteTable("events_fts_docsize", {
	id: integer().primaryKey(),
	sz: blob(),
});

export const eventsFtsConfig = sqliteTable("events_fts_config", {
	k: real().primaryKey().notNull(),
	v: real(),
});

export const userProfilesFts = sqliteTable("user_profiles_fts", {
	userId: real("user_id"),
	nickname: real(),
	firstName: real("first_name"),
	lastName: real("last_name"),
	bio: real(),
	showOnAbout: real("show_on_about"),
	userProfilesFts: real("user_profiles_fts"),
	rank: real(),
});

export const userProfilesFtsData = sqliteTable("user_profiles_fts_data", {
	id: integer().primaryKey(),
	block: blob(),
});

export const userProfilesFtsIdx = sqliteTable("user_profiles_fts_idx", {
	segid: real().notNull(),
	term: real().notNull(),
	pgno: real(),
},
(table) => [
	primaryKey({ columns: [table.segid, table.term], name: "user_profiles_fts_idx_segid_term_pk"})
]);

export const userProfilesFtsContent = sqliteTable("user_profiles_fts_content", {
	id: integer().primaryKey(),
	c0: real(),
	c1: real(),
	c2: real(),
	c3: real(),
	c4: real(),
	c5: real(),
});

export const userProfilesFtsDocsize = sqliteTable("user_profiles_fts_docsize", {
	id: integer().primaryKey(),
	sz: blob(),
});

export const userProfilesFtsConfig = sqliteTable("user_profiles_fts_config", {
	k: real().primaryKey().notNull(),
	v: real(),
});

export const products = sqliteTable("products", {
	id: text().primaryKey(),
	name: text().notNull(),
	description: text(),
	priceCents: integer("price_cents").notNull(),
	imageUrl: text("image_url"),
	active: integer().default(1),
	stockCount: integer("stock_count"),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
});

export const orders = sqliteTable("orders", {
	id: text().primaryKey(),
	stripeSessionId: text("stripe_session_id"),
	customerEmail: text("customer_email"),
	shippingName: text("shipping_name"),
	shippingAddressLine1: text("shipping_address_line1"),
	shippingAddressLine2: text("shipping_address_line2"),
	shippingCity: text("shipping_city"),
	shippingState: text("shipping_state"),
	shippingPostalCode: text("shipping_postal_code"),
	shippingCountry: text("shipping_country"),
	totalCents: integer("total_cents").notNull(),
	status: text().default("processing"),
	fulfillmentStatus: text("fulfillment_status").default("unfulfilled"),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
	updatedAt: text("updated_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_orders_email").on(table.customerEmail),
	index("idx_orders_status").on(table.status, table.fulfillmentStatus),
]);

export const rateLimits = sqliteTable("rate_limits", {
	ip: text().primaryKey(),
	count: integer().notNull(),
	expiresAt: integer("expires_at").notNull(),
});

export const socialQueue = sqliteTable("social_queue", {
	id: text().primaryKey(),
	content: text().notNull(),
	mediaUrls: text("media_urls"),
	scheduledFor: text("scheduled_for").notNull(),
	platforms: text().notNull(),
	status: text().notNull().default("pending"),
	createdAt: text("created_at").notNull().default("sql`(datetime('now'))`"),
	sentAt: text("sent_at"),
	errorMessage: text("error_message"),
	createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
	linkedType: text("linked_type"),
	linkedId: text("linked_id"),
	analytics: text(),
});

export const chatSessions = sqliteTable("chat_sessions", {
	id: text().primaryKey(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" } ),
	history: text().notNull(),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
	updatedAt: text("updated_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_chat_sessions_updated_at").on(table.updatedAt),
	index("idx_chat_sessions_user_id").on(table.userId),
]);

export const entityLinks = sqliteTable("entity_links", {
	id: text().primaryKey(),
	sourceType: text("source_type").notNull(),
	sourceId: text("source_id").notNull(),
	targetType: text("target_type").notNull(),
	targetId: text("target_id").notNull(),
	linkType: text("link_type"),
},
(table) => [
	index("idx_entity_links_target").on(table.targetType, table.targetId),
	index("idx_entity_links_source").on(table.sourceType, table.sourceId),
]);

export const financeTransactions = sqliteTable("finance_transactions", {
	id: text().primaryKey(),
	amount: real().notNull(),
	type: text().notNull(),
	category: text().notNull(),
	date: text().notNull(),
	description: text(),
	receiptUrl: text("receipt_url"),
	seasonId: integer("season_id").references(() => seasons.startYear, { onDelete: "set null" } ),
	loggedBy: text("logged_by"),
},
(table) => [
	index("idx_finance_tx_season").on(table.seasonId),
]);

export const sponsorshipPipeline = sqliteTable("sponsorship_pipeline", {
	id: text().primaryKey(),
	companyName: text("company_name").notNull(),
	contactPerson: text("contact_person"),
	status: text().notNull(),
	estimatedValue: real("estimated_value"),
	seasonId: integer("season_id").references(() => seasons.startYear, { onDelete: "set null" } ),
	notes: text(),
	zulipMessageId: text("zulip_message_id"),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_sponsorship_season").on(table.seasonId),
]);

export const sponsorshipAssignments = sqliteTable("sponsorship_assignments", {
	sponsorshipId: text("sponsorship_id").notNull().references(() => sponsorshipPipeline.id, { onDelete: "cascade" } ),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" } ),
},
(table) => [
	primaryKey({ columns: [table.sponsorshipId, table.userId], name: "sponsorship_assignments_sponsorship_id_user_id_pk"})
]);

export const documentSnapshots = sqliteTable("document_snapshots", {
	roomId: text("room_id").primaryKey(),
	state: blob().notNull(),
	updatedAt: real("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
},
(table) => [
	index("idx_document_snapshots_updated").on(table.updatedAt),
]);

export const simulations = sqliteTable("simulations", {
	id: text().primaryKey(),
	name: text().notNull(),
	description: text(),
	files: text().notNull(),
	authorId: text("author_id").notNull().references(() => user.id, { onDelete: "cascade" } ),
	isPublic: integer("is_public").default(0).notNull(),
	createdAt: text("created_at").default("sql`(datetime('now'))`").notNull(),
	updatedAt: text("updated_at").default("sql`(datetime('now'))`").notNull(),
},
(table) => [
	index("idx_simulations_public").on(table.isPublic),
	index("idx_simulations_author").on(table.authorId),
]);

export const pointsLedger = sqliteTable("points_ledger", {
	id: text().primaryKey(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" } ),
	pointsDelta: integer("points_delta").notNull(),
	reason: text().notNull(),
	createdBy: text("created_by").references(() => user.id, { onDelete: "set null" } ),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_points_ledger_user").on(table.userId),
]);

export const scoutingAnalyses = sqliteTable("scouting_analyses", {
	id: text().primaryKey(),
	seasonKey: text("season_key").notNull(),
	eventKey: text("event_key"),
	teamNumber: integer("team_number"),
	mode: text().notNull(),
	model: text().notNull(),
	markdown: text().notNull(),
	tokensUsed: integer("tokens_used"),
	createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "set null" }),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
},
(table) => [
	index("idx_scouting_analyses_team").on(table.teamNumber),
	index("idx_scouting_analyses_event").on(table.eventKey),
]);

export const externalKnowledgeSources = sqliteTable("external_knowledge_sources", {
	id: text().primaryKey(),
	type: text().notNull(),
	url: text().notNull(),
	branch: text(),
	status: text().default("active"),
	lastIndexedSha: text("last_indexed_sha"),
	lastIndexedAt: text("last_indexed_at"),
	createdAt: text("created_at").default("sql`(datetime('now'))`"),
});

export const performanceMetrics = sqliteTable("performance_metrics", {
	id: text().primaryKey(),
	metricName: text("metric_name").notNull(),
	value: real().notNull(),
	rating: text().notNull(),
	page: text().notNull(),
	timestamp: text().notNull(),
});
