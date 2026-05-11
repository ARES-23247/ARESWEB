import { eq, and, desc, sql, inArray } from "drizzle-orm";
import * as schema from "./schema";
import type { DrizzleDB } from "./types";

/**
 * Query helpers for common multi-table fetches.
 * Note: Drizzle v2's relational query API has limited support, so we use manual joins.
 */

export const queryHelpers = {
	/**
	 * Get event signups with user profiles.
	 * Uses manual JOIN since relational queries are limited in v2.
	 */
	getEventSignups: async (db: DrizzleDB, eventId: string, userId?: string) => {
		const whereConditions = [eq(schema.eventSignups.eventId, eventId)];
		if (userId) {
			whereConditions.push(eq(schema.eventSignups.userId, userId));
		}

		const signups = await db
			.select({
				id: schema.eventSignups.id,
				bringing: schema.eventSignups.bringing,
				notes: schema.eventSignups.notes,
				prepHours: schema.eventSignups.prepHours,
				attended: schema.eventSignups.attended,
				userId: schema.eventSignups.userId,
				userName: schema.user.name,
				userRole: schema.user.role,
				profileUserId: schema.userProfiles.userId,
				profileNickname: schema.userProfiles.nickname,
				dietaryRestrictions: schema.userProfiles.dietaryRestrictions,
			})
			.from(schema.eventSignups)
			.innerJoin(schema.user, eq(schema.eventSignups.userId, schema.user.id))
			.leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
			.where(and(...whereConditions));

		return { eventSignups: signups };
	},

	/**
	 * Get user with all related data for profile pages.
	 * Fetches user, profile, badges, and recent activity using separate queries.
	 */
	getUserWithRelations: async (db: DrizzleDB, userId: string) => {
		// Get user and profile
		const userResult = await db
			.select({
				id: schema.user.id,
				name: schema.user.name,
				email: schema.user.email,
				role: schema.user.role,
				image: schema.user.image,
				createdAt: schema.user.createdAt,
				nickname: schema.userProfiles.nickname,
				memberType: schema.userProfiles.memberType,
				bio: schema.userProfiles.bio,
			})
			.from(schema.user)
			.leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
			.where(eq(schema.user.id, userId))
			.limit(1);

		if (!userResult || userResult.length === 0) return null;

		const user = userResult[0];

		// Get user badges
		const badges = await db
			.select({
				id: schema.badges.id,
				name: schema.badges.name,
				description: schema.badges.description,
				iconType: schema.badges.icon,
				awardedAt: schema.userBadges.awardedAt,
			})
			.from(schema.userBadges)
			.innerJoin(schema.badges, eq(schema.userBadges.badgeId, schema.badges.id))
			.where(eq(schema.userBadges.userId, userId))
			.orderBy(desc(schema.userBadges.awardedAt));

		// Get recent tasks
		const tasks = await db
			.select({
				id: schema.tasks.id,
				title: schema.tasks.title,
				status: schema.tasks.status,
				priority: schema.tasks.priority,
				dueDate: schema.tasks.dueDate,
				createdAt: schema.tasks.createdAt,
			})
			.from(schema.tasks)
			.where(eq(schema.tasks.createdBy, userId))
			.orderBy(desc(schema.tasks.createdAt))
			.limit(5);

		// Get recent comments
		const comments = await db
			.select({
				id: schema.comments.id,
				content: schema.comments.content,
				createdAt: schema.comments.createdAt,
				targetType: schema.comments.targetType,
				targetId: schema.comments.targetId,
			})
			.from(schema.comments)
			.where(eq(schema.comments.userId, userId))
			.orderBy(desc(schema.comments.createdAt))
			.limit(5);

		return {
			...user,
			userBadges: badges,
			tasks,
			comments,
		};
	},

	/**
	 * Get task with assignees and creator info.
	 */
	getTaskWithRelations: async (db: DrizzleDB, taskId: string) => {
		// Get task with creator
		const taskResult = await db
			.select({
				id: schema.tasks.id,
				title: schema.tasks.title,
				description: schema.tasks.description,
				status: schema.tasks.status,
				priority: schema.tasks.priority,
				dueDate: schema.tasks.dueDate,
				sortOrder: schema.tasks.sortOrder,
				createdAt: schema.tasks.createdAt,
				updatedAt: schema.tasks.updatedAt,
				creatorId: schema.tasks.createdBy,
				creatorName: schema.user.name,
				creatorNickname: schema.userProfiles.nickname,
			})
			.from(schema.tasks)
			.innerJoin(schema.user, eq(schema.tasks.createdBy, schema.user.id))
			.leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
			.where(eq(schema.tasks.id, taskId))
			.limit(1);

		if (!taskResult || taskResult.length === 0) return null;

		// Get assignees
		const assignees = await db
			.select({
				userId: schema.taskAssignments.userId,
				userName: schema.user.name,
				userNickname: schema.userProfiles.nickname,
			})
			.from(schema.taskAssignments)
			.innerJoin(schema.user, eq(schema.taskAssignments.userId, schema.user.id))
			.leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
			.where(eq(schema.taskAssignments.taskId, taskId));

		return {
			...taskResult[0],
			taskAssignments: assignees,
		};
	},

	/**
	 * Get all tasks with assignees (batch version for lists).
	 */
	getTasksWithAssignees: async (db: DrizzleDB, limit = 50, offset = 0) => {
		const tasks = await db
			.select({
				id: schema.tasks.id,
				title: schema.tasks.title,
				status: schema.tasks.status,
				priority: schema.tasks.priority,
				dueDate: schema.tasks.dueDate,
				sortOrder: schema.tasks.sortOrder,
				createdAt: schema.tasks.createdAt,
				creatorId: schema.tasks.createdBy,
				creatorName: schema.user.name,
				creatorNickname: schema.userProfiles.nickname,
			})
			.from(schema.tasks)
			.innerJoin(schema.user, eq(schema.tasks.createdBy, schema.user.id))
			.leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
			.limit(limit)
			.offset(offset)
			.orderBy(schema.tasks.sortOrder, desc(schema.tasks.createdAt));

		// Get assignees for all tasks using IN clause to avoid N+1 query
		const taskIds = tasks.map(t => t.id);
		const assignees = taskIds.length > 0 ? await db
			.select({
				taskId: schema.taskAssignments.taskId,
				userId: schema.taskAssignments.userId,
				userName: schema.user.name,
				userNickname: schema.userProfiles.nickname,
			})
			.from(schema.taskAssignments)
			.innerJoin(schema.user, eq(schema.taskAssignments.userId, schema.user.id))
			.leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
			.where(inArray(schema.taskAssignments.taskId, taskIds)) : [];

		// Group assignees by task
		const assigneesByTask: Record<string, typeof assignees> = {};
		for (const a of assignees) {
			if (!assigneesByTask[a.taskId]) {
				assigneesByTask[a.taskId] = [];
			}
			assigneesByTask[a.taskId].push(a);
		}

		return tasks.map(t => ({
			...t,
			taskAssignments: assigneesByTask[t.id] || [],
		}));
	},

	/**
	 * Get users with profiles for user lists.
	 * Supports cursor-based pagination.
	 */
	getUsersWithProfiles: async (db: DrizzleDB, limit = 50, cursor?: string) => {
		let whereCondition;
		if (cursor) {
			// Convert cursor string to number for timestamp comparison
			whereCondition = sql`${schema.user.createdAt} < ${Number(cursor)}`;
		}

		const users = await db
			.select({
				id: schema.user.id,
				name: schema.user.name,
				email: schema.user.email,
				emailVerified: schema.user.emailVerified,
				image: schema.user.image,
				role: schema.user.role,
				createdAt: schema.user.createdAt,
				updatedAt: schema.user.updatedAt,
				nickname: schema.userProfiles.nickname,
				memberType: schema.userProfiles.memberType,
			})
			.from(schema.user)
			.leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
			.where(whereCondition)
			.orderBy(desc(schema.user.createdAt))
			.limit(limit);

		return users;
	},

	/**
	 * Get posts with author data.
	 * Supports pagination.
	 */
	getPostsWithAuthors: async (db: DrizzleDB, limit = 10, offset = 0) => {
		const posts = await db
			.select({
				slug: schema.posts.slug,
				title: schema.posts.title,
				date: schema.posts.date,
				snippet: schema.posts.snippet,
				thumbnail: schema.posts.thumbnail,
				status: schema.posts.status,
				author: schema.posts.author,
				cfEmail: schema.posts.cfEmail,
				seasonId: schema.posts.seasonId,
				publishedAt: schema.posts.publishedAt,
				isPortfolio: schema.posts.isPortfolio,
				zulipStream: schema.posts.zulipStream,
				zulipTopic: schema.posts.zulipTopic,
				authorNickname: schema.userProfiles.nickname,
				authorAvatar: schema.user.image,
				authorEmail: schema.user.email,
			})
			.from(schema.posts)
			.leftJoin(schema.user, eq(schema.posts.cfEmail, schema.user.email))
			.leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
			.where(eq(schema.posts.isDeleted, 0))
			.orderBy(desc(schema.posts.date))
			.limit(limit)
			.offset(offset);

		return posts;
	},

	/**
	 * Get comments with user data for a target.
	 */
	getCommentsWithUsers: async (db: DrizzleDB, targetType: string, targetId: string) => {
		const comments = await db
			.select({
				id: schema.comments.id,
				userId: schema.comments.userId,
				content: schema.comments.content,
				createdAt: schema.comments.createdAt,
				updatedAt: schema.comments.updatedAt,
				nickname: schema.userProfiles.nickname,
				avatar: schema.user.image,
				userRole: schema.user.role,
			})
			.from(schema.comments)
			.innerJoin(schema.userProfiles, eq(schema.comments.userId, schema.userProfiles.userId))
			.innerJoin(schema.user, eq(schema.comments.userId, schema.user.id))
			.where(
				and(
					eq(schema.comments.targetType, targetType),
					eq(schema.comments.targetId, targetId),
					eq(schema.comments.isDeleted, 0),
				),
			)
			.orderBy(schema.comments.createdAt);

		return comments;
	},

	/**
	 * Get badge leaderboard with user profiles.
	 */
	getBadgeLeaderboard: async (db: DrizzleDB, limit = 20) => {
		const results = await db
			.select({
				userId: schema.userProfiles.userId,
				nickname: schema.userProfiles.nickname,
				memberType: schema.userProfiles.memberType,
				badgeCount: sql<number>`count(${schema.userBadges.id})`.as("badge_count"),
			})
			.from(schema.userProfiles)
			.innerJoin(schema.userBadges, eq(schema.userProfiles.userId, schema.userBadges.userId))
			.where(eq(schema.userProfiles.showOnAbout, 1))
			.groupBy(schema.userProfiles.userId, schema.userProfiles.nickname, schema.userProfiles.memberType)
			.orderBy(desc(sql`count(${schema.userBadges.id})`), schema.userProfiles.nickname)
			.limit(limit);

		return results;
	},

	/**
	 * Batch lookup of location addresses.
	 * Returns a map of location name -> address.
	 */
	getLocationAddresses: async (db: DrizzleDB, locationNames: string[]) => {
		if (locationNames.length === 0) return {};

		try {
			const locs = await db
				.select({
					name: schema.locations.name,
					address: schema.locations.address,
				})
				.from(schema.locations)
				.where(inArray(schema.locations.name, locationNames))
				.all();

			const locationMap: Record<string, string> = {};
			locs.forEach((l) => {
				if (l.address) locationMap[l.name] = l.address;
			});
			return locationMap;
		} catch {
			// Locations table may not exist
			return {};
		}
	},
};

/**
 * Transaction helpers for multi-step operations.
 * Ensures atomicity — all steps succeed or none do.
 */
export const transactionHelpers = {
	/**
	 * Create a task with initial assignees atomically.
	 * Either both the task and assignments are created, or neither.
	 */
	createTaskWithAssignees: async (
		db: DrizzleDB,
		taskData: typeof schema.tasks.$inferInsert,
		assigneeIds: string[] = [],
	) => {
		return db.transaction(async (tx) => {
			// Insert the task
			await tx.insert(schema.tasks).values(taskData);

			// Insert assignments if provided
			if (assigneeIds.length > 0) {
				const assignments = assigneeIds.map((userId) => ({
					taskId: taskData.id,
					userId,
				}));
				await tx.insert(schema.taskAssignments).values(assignments);
			}

			return { success: true, taskId: taskData.id };
		});
	},

	/**
	 * Create an event with document history atomically.
	 * Ensures event description is always saved to history.
	 */
	createEventWithHistory: async (
		db: DrizzleDB,
		eventData: typeof schema.events.$inferInsert,
		documentHistoryData: {
			roomId: string;
			content: string;
			createdBy: string;
		},
	) => {
		return db.transaction(async (tx) => {
			// Insert the event
			await tx.insert(schema.events).values(eventData);

			// Insert document history if content provided
			if (documentHistoryData.content) {
				await tx.insert(schema.documentHistory).values({
					roomId: documentHistoryData.roomId,
					content: documentHistoryData.content,
					createdBy: documentHistoryData.createdBy,
					createdAt: Date.now(),
				});
			}

			return { success: true, eventId: eventData.id };
		});
	},

	/**
	 * Create or update an event signup using upsert.
	 * Uses onConflictDoUpdate for atomic insert-or-update.
	 */
	createEventSignup: async (
		db: DrizzleDB,
		signupData: typeof schema.eventSignups.$inferInsert,
	) => {
		await db
			.insert(schema.eventSignups)
			.values(signupData)
			.onConflictDoUpdate({
				target: [schema.eventSignups.eventId, schema.eventSignups.userId],
				set: {
					bringing: signupData.bringing,
					notes: signupData.notes,
					prepHours: signupData.prepHours,
				},
			});

		return { success: true };
	},

	/**
	 * Update task assignments atomically.
	 * Deletes old assignments and inserts new ones in one transaction.
	 */
	updateTaskAssignments: async (
		db: DrizzleDB,
		taskId: string,
		newAssigneeIds: string[],
	) => {
		return db.transaction(async (tx) => {
			// Delete existing assignments
			await tx.delete(schema.taskAssignments).where(eq(schema.taskAssignments.taskId, taskId));

			// Insert new assignments
			if (newAssigneeIds.length > 0) {
				const assignments = newAssigneeIds.map((userId) => ({
					taskId,
					userId,
				}));
				await tx.insert(schema.taskAssignments).values(assignments);
			}

			return { success: true };
		});
	},

	/**
	 * Create events with recurrence rule atomically.
	 * Generates all instances and inserts them in one transaction.
	 */
	createEventsWithRecurrence: async (
		db: DrizzleDB,
		baseEventData: Omit<typeof schema.events.$inferInsert, "id">,
		rrule?: string,
	) => {
		return db.transaction(async (tx) => {
			// Check for existing duplicate
			const existing = await tx
				.select({ id: schema.events.id })
				.from(schema.events)
				.where(
					and(
						eq(schema.events.title, baseEventData.title as string),
						eq(schema.events.dateStart, baseEventData.dateStart as string),
						eq(schema.events.isDeleted, 0),
					),
				)
				.get();

			if (existing) {
				return { success: true, id: existing.id, warning: "Double-submission prevented" };
			}

			// Generate instances if rrule provided
			const instances: typeof schema.events.$inferInsert[] = [];

			if (rrule) {
				// Import rrulestr dynamically
				const { rrulestr } = await import("rrule");
				const rule = rrulestr(rrule, { dtstart: new Date(baseEventData.dateStart as string) });
				const dates = rule.all((_d: Date, i: number) => i < 52);

				const duration = baseEventData.dateEnd
					? new Date(baseEventData.dateEnd as string).getTime() -
					  new Date(baseEventData.dateStart as string).getTime()
					: 0;

				instances.push(...dates.map((d: Date, i: number) => {
					const instStart = d.toISOString();
					const instEnd = baseEventData.dateEnd
						? new Date(d.getTime() + duration).toISOString()
						: null;
					return {
						...baseEventData,
						id: i === 0 ? crypto.randomUUID() : crypto.randomUUID(),
						dateStart: instStart,
						dateEnd: instEnd,
					};
				}));
			}

			// If no recurrence, add single instance
			if (instances.length === 0) {
				instances.push({
					...baseEventData,
					id: crypto.randomUUID(),
				});
			}

			// Insert all instances in chunks
			const CHUNK_SIZE = 5;
			for (let i = 0; i < instances.length; i += CHUNK_SIZE) {
				await tx.insert(schema.events).values(instances.slice(i, i + CHUNK_SIZE));
			}

			return { success: true, id: instances[0].id };
		});
	},

	/**
	 * Approve event with revision merge atomically.
	 * Updates original event and deletes shadow revision in one transaction.
	 */
	approveEventWithRevision: async (db: DrizzleDB, eventId: string) => {
		return db.transaction(async (tx) => {
			const row = await tx
				.select({
					id: schema.events.id,
					title: schema.events.title,
					dateStart: schema.events.dateStart,
					dateEnd: schema.events.dateEnd,
					location: schema.events.location,
					description: schema.events.description,
					coverImage: schema.events.coverImage,
					tbaEventKey: schema.events.tbaEventKey,
					status: schema.events.status,
					isPotluck: schema.events.isPotluck,
					isVolunteer: schema.events.isVolunteer,
					seasonId: schema.events.seasonId,
					meetingNotes: schema.events.meetingNotes,
					revisionOf: schema.events.revisionOf,
					gcalEventId: schema.events.gcalEventId,
				})
				.from(schema.events)
				.where(eq(schema.events.id, eventId))
				.get();

			if (!row) {
				return { success: false, error: "Event not found" };
			}

			if (row.revisionOf) {
				// Merge revision: update original and delete shadow
				await tx
					.update(schema.events)
					.set({
						title: row.title,
						dateStart: row.dateStart,
						dateEnd: row.dateEnd,
						location: row.location,
						description: row.description,
						coverImage: row.coverImage,
						tbaEventKey: row.tbaEventKey,
						status: "published",
						isPotluck: row.isPotluck,
						isVolunteer: row.isVolunteer,
						seasonId: row.seasonId,
						meetingNotes: row.meetingNotes,
					})
					.where(eq(schema.events.id, row.revisionOf));
				await tx.delete(schema.events).where(eq(schema.events.id, eventId));
			} else {
				// Just publish
				await tx.update(schema.events).set({ status: "published" }).where(eq(schema.events.id, eventId));
			}

			return { success: true };
		});
	},

	/**
	 * Save inquiry with optional sponsor creation atomically.
	 * Creates both inquiry and sponsor records in one transaction.
	 */
	saveInquiryWithSponsor: async (
		db: DrizzleDB,
		inquiryData: typeof schema.inquiries.$inferInsert,
		isSponsor: boolean,
		sponsorData?: Omit<typeof schema.sponsors.$inferInsert, "id">,
	) => {
		return db.transaction(async (tx) => {
			// Check for recent duplicate submissions (within 1 hour)
			const recentCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
			const recent = await tx
				.select({ id: schema.inquiries.id })
				.from(schema.inquiries)
				.where(
					and(
						eq(schema.inquiries.type, inquiryData.type as string),
						eq(schema.inquiries.email, inquiryData.email as string),
						sql`${schema.inquiries.createdAt} > ${recentCutoff}`,
					),
				)
				.get();

			if (recent) {
				return { success: true, warning: "Recent submission exists" };
			}

			// Insert inquiry
			await tx.insert(schema.inquiries).values(inquiryData);

			// If sponsor type, also create sponsor record
			if (isSponsor && sponsorData) {
				await tx.insert(schema.sponsors).values({
					id: inquiryData.id as string,
					...sponsorData,
				});
			}

			return { success: true, id: inquiryData.id };
		});
	},

	/**
	 * Save document with history capture atomically.
	 * Creates history record before updating document.
	 */
	saveDocWithHistory: async (
		db: DrizzleDB,
		docSlug: string,
		docData: typeof schema.docs.$inferInsert,
		createHistory: boolean,
		_historyData?: {
			title: string;
			category: string;
			description: string;
			content: string;
			authorEmail: string;
		},
	) => {
		return db.transaction(async (tx) => {
			// Get existing document
			const existing = await tx
				.select({
					slug: schema.docs.slug,
					title: schema.docs.title,
					category: schema.docs.category,
					description: schema.docs.description,
					content: schema.docs.content,
					cfEmail: schema.docs.cfEmail,
				})
				.from(schema.docs)
				.where(eq(schema.docs.slug, docSlug))
				.get();

			// Create history if requested and document exists
			if (createHistory && existing) {
				await tx.insert(schema.docsHistory).values({
					slug: existing.slug,
					title: existing.title,
					category: existing.category,
					description: existing.description || "",
					content: existing.content,
					authorEmail: existing.cfEmail || "unknown",
				});
			}

			// Insert or update document
			if (existing) {
				await tx
					.update(schema.docs)
					.set({
						title: docData.title,
						category: docData.category,
						description: docData.description,
						content: docData.content,
						...(docData.cfEmail && { cfEmail: docData.cfEmail }),
					})
					.where(eq(schema.docs.slug, docSlug));
			} else {
				await tx.insert(schema.docs).values(docData);
			}

			return { success: true, slug: docSlug };
		});
	},

	/**
	 * Update post with history capture atomically.
	 */
	updatePostWithHistory: async (
		db: DrizzleDB,
		slug: string,
		updates: Partial<typeof schema.posts.$inferInsert>,
	) => {
		return db.transaction(async (tx) => {
			// Get current post
			const current = await tx
				.select({
					slug: schema.posts.slug,
					title: schema.posts.title,
					author: schema.posts.author,
					thumbnail: schema.posts.thumbnail,
					snippet: schema.posts.snippet,
					ast: schema.posts.ast,
					cfEmail: schema.posts.cfEmail,
					seasonId: schema.posts.seasonId,
				})
				.from(schema.posts)
				.where(eq(schema.posts.slug, slug))
				.get();

			if (current) {
				// Capture history
				await tx.insert(schema.postsHistory).values({
					slug: current.slug,
					title: current.title,
					author: current.author,
					thumbnail: current.thumbnail,
					snippet: current.snippet,
					ast: current.ast,
					authorEmail: current.cfEmail || "unknown",
					seasonId: current.seasonId,
				});
			}

			// Update post
			await tx
				.update(schema.posts)
				.set({
					...(updates.title && { title: updates.title }),
					...(updates.author && { author: updates.author }),
					...(updates.thumbnail && { thumbnail: updates.thumbnail }),
					...(updates.snippet !== undefined && { snippet: updates.snippet }),
					...(updates.ast && { ast: updates.ast }),
					...(updates.cfEmail && { cfEmail: updates.cfEmail }),
				})
				.where(eq(schema.posts.slug, slug));

			return { success: true };
		});
	},

	/**
	 * Create award with duplicate-safe handling atomically.
	 * Checks for duplicates by title/year before inserting.
	 */
	createAwardSafely: async (db: DrizzleDB, awardData: typeof schema.awards.$inferInsert) => {
		return db.transaction(async (tx) => {
			// Check if exists by ID
			const byId = await tx
				.select({ id: schema.awards.id })
				.from(schema.awards)
				.where(eq(schema.awards.id, awardData.id as number))
				.get();

			if (byId) {
				return { success: true, id: byId.id, existed: true };
			}

			// Check for duplicates by title/year
			const duplicate = await tx
				.select({ id: schema.awards.id })
				.from(schema.awards)
				.where(
					and(
						eq(schema.awards.title, awardData.title as string),
						eq(schema.awards.date, String(awardData.date)),
						eq(schema.awards.eventName, awardData.eventName as string || ""),
						eq(schema.awards.isDeleted, 0),
					),
				)
				.get();

			if (duplicate) {
				return { success: true, id: duplicate.id, existed: true };
			}

			// Insert new award
			const result = await tx.insert(schema.awards).values(awardData).returning();
			return { success: true, id: result[0].id, existed: false };
		});
	},
};
