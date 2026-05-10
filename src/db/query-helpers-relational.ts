/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DRIZZLE RELATIONAL QUERY HELPERS
 * ─────────────────────────────────────────────────────────────────────────────
 * Type-safe relational queries using Drizzle's `db.query` API.
 * Provides automatic JOIN handling and nested result structures.
 *
 * These helpers complement (not replace) the manual JOIN queries in query-helpers.ts.
 * Use relational queries when:
 * - You need nested data structures (e.g., user with profile and badges)
 * - You want automatic JOIN handling
 * - You prefer the declarative `with` syntax
 *
 * Use manual JOIN queries (from query-helpers.ts) when:
 * - You need custom SELECT fields
 * - You have complex aggregation (GROUP BY, COUNT, etc.)
 * - You need raw SQL performance optimizations
 *
 * Usage:
 *   import { relationalQueries } from '@src/db/query-helpers-relational';
 *   import { eq } from 'drizzle-orm';
 *
 *   // Get user with all relations
 *   const user = await relationalQueries.getUserWithAll(db, userId);
 *
 *   // Get event with signups and user profiles
 *   const event = await relationalQueries.getEventWithSignups(db, eventId);
 *
 *   // Get task with assignees
 *   const task = await relationalQueries.getTaskWithAssignees(db, taskId);
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { eq, and, desc, inArray } from 'drizzle-orm';
import * as schema from './schema';
import type { DrizzleDB } from './types';

// ============================================================================
// RELATIONAL QUERY HELPERS
// ============================================================================

/**
 * Relational query helpers using Drizzle's `db.query` API.
 *
 * These provide type-safe nested queries with automatic JOIN handling.
 */
export const relationalQueries = {
  // ==========================================================================
  // USER QUERIES
  // ==========================================================================

  /**
   * Get user with profile, badges, and recent activity.
   * Single query fetches all related data.
   *
   * @example
   * const user = await relationalQueries.getUserWithAll(db, 'user-123');
   * // Returns: { id, name, email, profile: {...}, userBadges: [...], ... }
   */
  getUserWithAll: async (db: DrizzleDB, userId: string) => {
    // Use Drizzle's query API with relations
    const result = await (db as any).query.user.findFirst({
      where: eq(schema.user.id, userId),
      with: {
        profile: true,
        userBadges: {
          with: {
            badge: true,
          },
          orderBy: desc(schema.userBadges.awardedAt),
        },
        sessions: {
          columns: {
            token: false, // Exclude sensitive token
            ipAddress: false,
            userAgent: false,
          },
          orderBy: desc(schema.session.createdAt),
          limit: 5,
        },
        accounts: {
          columns: {
            accessToken: false,
            refreshToken: false,
            idToken: false,
            password: false,
          },
        },
      },
    });

    return result;
  },

  /**
   * Get user with minimal relations for lists.
   */
  getUserWithProfile: async (db: DrizzleDB, userId: string) => {
    return (db as any).query.user.findFirst({
      where: eq(schema.user.id, userId),
      with: {
        profile: true,
      },
      columns: {
        // Exclude sensitive fields
        twoFactorEnabled: false,
        twoFactorSecret: false,
        twoFactorBackupCodes: false,
      },
    });
  },

  /**
   * Get users with profiles for leaderboard/about pages.
   */
  getUsersForLeaderboard: async (db: DrizzleDB, limit = 50) => {
    return (db as any).query.user.findMany({
      with: {
        profile: {
          columns: {
            nickname: true,
            memberType: true,
            bio: true,
            hours: true,
            attendanceCount: true,
            showOnAbout: true,
          },
        },
        userBadges: {
          with: {
            badge: {
              columns: {
                name: true,
                description: true,
                icon: true,
                category: true,
                xp: true,
              },
            },
          },
        },
      },
      where: eq(schema.userProfiles.showOnAbout, 1),
      orderBy: desc(schema.userProfiles.hours),
      limit,
    });
  },

  // ==========================================================================
  // EVENT QUERIES
  // ==========================================================================

  /**
   * Get event with all signups including user profiles.
   */
  getEventWithSignups: async (db: DrizzleDB, eventId: string) => {
    return (db as any).query.events.findFirst({
      where: eq(schema.events.id, eventId),
      with: {
        signups: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                image: true,
                email: false, // Exclude email for privacy
              },
              with: {
                profile: {
                  columns: {
                    nickname: true,
                    dietaryRestrictions: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  },

  /**
   * Get events with signup counts.
   * Useful for event list views.
   */
  getEventsWithSignupCounts: async (db: DrizzleDB, limit = 50, offset = 0) => {
    const events = await (db as any).query.events.findMany({
      where: eq(schema.events.isDeleted, 0),
      with: {
        signups: {
          columns: {
            userId: true,
            attended: true,
          },
        },
      },
      orderBy: desc(schema.events.dateStart),
      limit,
      offset,
    });

    // Add signup counts
    return events.map((event: any) => ({
      ...event,
      signupCount: event.signups?.length || 0,
      attendedCount: event.signups?.filter((s: any) => s.attended).length || 0,
    }));
  },

  // ==========================================================================
  // TASK QUERIES
  // ==========================================================================

  /**
   * Get task with assignees and creator.
   */
  getTaskWithRelations: async (db: DrizzleDB, taskId: string) => {
    return (db as any).query.tasks.findFirst({
      where: eq(schema.tasks.id, taskId),
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
          with: {
            profile: {
              columns: {
                nickname: true,
              },
            },
          },
        },
        assignments: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                image: true,
              },
              with: {
                profile: {
                  columns: {
                    nickname: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  },

  /**
   * Get tasks with assignees (for lists/boards).
   */
  getTasksWithAssignees: async (db: DrizzleDB, limit = 50, offset = 0) => {
    return (db as any).query.tasks.findMany({
      where: eq(schema.tasks.isDeleted, 0),
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
          },
        },
        assignments: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: [schema.tasks.sortOrder, desc(schema.tasks.createdAt)],
      limit,
      offset,
    });
  },

  // ==========================================================================
  // POST QUERIES
  // ==========================================================================

  /**
   * Get post with history entries.
   */
  getPostWithHistory: async (db: DrizzleDB, slug: string) => {
    return (db as any).query.posts.findFirst({
      where: eq(schema.posts.slug, slug),
      with: {
        season: {
          columns: {
            startYear: true,
            endYear: true,
            name: true,
          },
        },
        history: {
          orderBy: desc(schema.postsHistory.createdAt),
          limit: 10,
        },
        comments: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          where: eq(schema.comments.isDeleted, 0),
        },
      },
    });
  },

  /**
   * Get posts with season info.
   */
  getPostsWithSeasons: async (db: DrizzleDB, limit = 10, offset = 0) => {
    return (db as any).query.posts.findMany({
      where: and(
        eq(schema.posts.isDeleted, 0),
        eq(schema.posts.status, 'published')
      ),
      with: {
        season: {
          columns: {
            startYear: true,
            endYear: true,
            name: true,
          },
        },
      },
      orderBy: desc(schema.posts.publishedAt),
      limit,
      offset,
    });
  },

  // ==========================================================================
  // DOC QUERIES
  // ==========================================================================

  /**
   * Get doc with history and contributors.
   */
  getDocWithHistory: async (db: DrizzleDB, slug: string) => {
    return (db as any).query.docs.findFirst({
      where: eq(schema.docs.slug, slug),
      with: {
        history: {
          orderBy: desc(schema.docsHistory.createdAt),
          limit: 10,
        },
        contributors: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        feedback: {
          where: eq(schema.docsFeedback.isResolved, 0),
        },
      },
    });
  },

  // ==========================================================================
  // COMMENT QUERIES
  // ==========================================================================

  /**
   * Get comments for a target with user info.
   */
  getCommentsWithUsers: async (db: DrizzleDB, targetType: string, targetId: string) => {
    return (db as any).query.comments.findMany({
      where: and(
        eq(schema.comments.targetType, targetType),
        eq(schema.comments.targetId, targetId),
        eq(schema.comments.isDeleted, 0)
      ),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            image: true,
            role: true,
          },
        },
      },
      orderBy: schema.comments.createdAt,
    });
  },

  // ==========================================================================
  // NOTIFICATION QUERIES
  // ==========================================================================

  /**
   * Get notifications for a user.
   */
  getNotificationsForUser: async (db: DrizzleDB, userId: string, limit = 20) => {
    return (db as any).query.notifications.findMany({
      where: eq(schema.notifications.userId, userId),
      orderBy: desc(schema.notifications.createdAt),
      limit,
    });
  },

  // ==========================================================================
  // BADGE QUERIES
  // ==========================================================================

  /**
   * Get badge with all users who have earned it.
   */
  getBadgeWithUsers: async (db: DrizzleDB, badgeId: string) => {
    return (db as any).query.badges.findFirst({
      where: eq(schema.badges.id, badgeId),
      with: {
        userBadges: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                image: true,
              },
              with: {
                profile: {
                  columns: {
                    nickname: true,
                  },
                },
              },
            },
          },
          orderBy: desc(schema.userBadges.awardedAt),
        },
      },
    });
  },

  /**
   * Get all badges with user counts.
   */
  getBadgesWithCounts: async (db: DrizzleDB) => {
    const badges = await (db as any).query.badges.findMany({
      with: {
        userBadges: {
          columns: {
            id: true,
          },
        },
      },
    });

    return badges.map((badge: any) => ({
      ...badge,
      userCount: badge.userBadges?.length || 0,
    }));
  },

  // ==========================================================================
  // SPONSOR QUERIES
  // ==========================================================================

  /**
   * Get sponsor with metrics and tokens.
   */
  getSponsorWithMetrics: async (db: DrizzleDB, sponsorId: string) => {
    return (db as any).query.sponsors.findFirst({
      where: eq(schema.sponsors.id, sponsorId),
      with: {
        metrics: {
          orderBy: desc(schema.sponsorMetrics.createdAt),
          limit: 12,
        },
        tokens: true,
      },
    });
  },

  /**
   * Get all active sponsors with latest metrics.
   */
  getSponsorsWithLatestMetrics: async (db: DrizzleDB) => {
    return (db as any).query.sponsors.findMany({
      where: eq(schema.sponsors.isActive, 1),
      with: {
        metrics: {
          orderBy: desc(schema.sponsorMetrics.createdAt),
          limit: 1,
        },
      },
    });
  },

  // ==========================================================================
  // SEASON QUERIES
  // ==========================================================================

  /**
   * Get season with posts and awards.
   */
  getSeasonWithContent: async (db: DrizzleDB, startYear: number) => {
    return (db as any).query.seasons.findFirst({
      where: eq(schema.seasons.startYear, startYear),
      with: {
        posts: {
          where: and(
            eq(schema.posts.isDeleted, 0),
            eq(schema.posts.status, 'published')
          ),
          columns: {
            slug: true,
            title: true,
            date: true,
            thumbnail: true,
          },
        },
        awards: {
          where: eq(schema.awards.isDeleted, 0),
        },
      },
    });
  },
};

// ============================================================================
// BATCH QUERY HELPERS
// ============================================================================

/**
 * Batch query helpers for fetching related data in bulk.
 * Reduces N+1 query issues.
 */
export const batchRelationalQueries = {
  /**
   * Get all users referenced in a list (for resolving user IDs to names).
   */
  getUsersByIds: async (db: DrizzleDB, userIds: string[]) => {
    if (userIds.length === 0) return [];

    return (db as any).query.user.findMany({
      where: inArray(schema.user.id, userIds),
      with: {
        profile: {
          columns: {
            nickname: true,
            memberType: true,
          },
        },
      },
      columns: {
        id: true,
        name: true,
        image: true,
        email: false,
      },
    });
  },

  /**
   * Get all tasks with assignees for a list of task IDs.
   */
  getTasksByIds: async (db: DrizzleDB, taskIds: string[]) => {
    if (taskIds.length === 0) return [];

    return (db as any).query.tasks.findMany({
      where: inArray(schema.tasks.id, taskIds),
      with: {
        assignments: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });
  },

  /**
   * Get all events with signup counts for a list of event IDs.
   */
  getEventsByIds: async (db: DrizzleDB, eventIds: string[]) => {
    if (eventIds.length === 0) return [];

    const events = await (db as any).query.events.findMany({
      where: inArray(schema.events.id, eventIds),
      with: {
        signups: {
          columns: {
            userId: true,
            attended: true,
          },
        },
      },
    });

    return events.map((event: any) => ({
      ...event,
      signupCount: event.signups?.length || 0,
    }));
  },
};

// ============================================================================
// QUERY BUILDER HELPERS
// ============================================================================

/**
 * Helper to build a Drizzle query with relations dynamically.
 * Useful for API endpoints that accept `include` query parameters.
 */
export function buildRelationalQuery<T extends keyof typeof schema>(
  tableName: T,
  options: {
    where?: ReturnType<typeof eq>;
    include?: string[];
    limit?: number;
    offset?: number;
  }
) {
  const withClause: Record<string, boolean | { columns?: Record<string, boolean> }> = {};

  // Build the `with` clause based on include array
  if (options.include) {
    for (const field of options.include) {
      withClause[field] = true;
    }
  }

  return {
    table: tableName,
    where: options.where,
    with: withClause,
    limit: options.limit,
    offset: options.offset,
  };
}
