# API Response Naming Migration Plan

## Current State

The ARESWEB API uses **mixed naming conventions**:

- **Request params/body**: `camelCase` (e.g., `userId`, `seasonId`)
- **Response bodies**: `snake_case` (e.g., `user_id`, `season_id`, `member_type`)

This inconsistency creates confusion and violates TypeScript conventions.

## Goal

Standardize ALL API responses to use **camelCase** consistently.

## Migration Strategy

Given the scope (35+ route files, frontend consumers, tests), this will be a **phased migration**:

### Phase 1: Core User & Profile Routes (HIGH PRIORITY)
- [ ] `shared/routes/profiles.ts` - Update `profileMeSchema`, `rosterMemberSchema`
- [ ] `shared/routes/users.ts` - Update `userResponseSchema`  
- [ ] `shared/routes/auth.ts` - Update `authSchema`
- [ ] Update route handlers in `functions/api/routes/profiles.ts`
- [ ] Update route handlers in `functions/api/routes/users.ts`
- [ ] Update frontend consumers in `src/api/profiles.ts`, `src/api/users.ts`
- [ ] Update tests

### Phase 2: Points & Badges Routes
- [ ] `shared/routes/points.ts` - Update schemas
- [ ] `shared/routes/badges.ts` - Update schemas
- [ ] Update route handlers
- [ ] Update frontend & tests

### Phase 3: Content Routes (Posts, Events, Docs)
- [ ] `shared/routes/posts.ts`
- [ ] `shared/routes/events.ts`
- [ ] `shared/routes/docs.ts`
- [ ] Update handlers, frontend, tests

### Phase 4: Remaining Routes
- [ ] All other route files

## Field Name Mappings

### Common Patterns
| snake_case | camelCase |
|------------|-----------|
| user_id | userId |
| member_type | memberType |
| points_delta | pointsDelta |
| points_balance | pointsBalance |
| created_at | createdAt |
| updated_at | updatedAt |
| email_verified | emailVerified |
| first_name | firstName |
| last_name | lastName |
| profile_pic | profilePic |
| team_id | teamId |
| season_id | seasonId |
| post_id | postId |
| is_deleted | isDeleted |
| is_public | isPublic |
| badge_count | badgeCount |
| contact_email | contactEmail |
| show_email | showEmail |
| show_phone | showPhone |
| show_on_about | showOnAbout |
| favorite_food | favoriteFood |
| dietary_restrictions | dietaryRestrictions |
| favorite_robot_mechanism | favoriteRobotMechanism |
| pre_match_superstition | preMatchSuperstition |
| leadership_role | leadershipRole |
| rookie_year | rookieYear |
| tshirt_size | tshirtSize |
| emergency_contact_name | emergencyContactName |
| emergency_contact_phone | emergencyContactPhone |
| parents_name | parentsName |
| parents_email | parentsEmail |
| students_name | studentsName |
| students_email | studentsEmail |
| color_theme | colorTheme |
| event_name | eventName |
| image_url | imageUrl |
| cover_image | coverImage |
| date_start | dateStart |
| date_end | dateEnd |
| meeting_notes | meetingNotes |
| recurring_group_id | recurringGroupId |
| zulip_stream | zulipStream |
| zulip_topic | zulipTopic |
| location_address | locationAddress |
| tba_event_key | tbaEventKey |
| is_potluck | isPotluck |
| is_volunteer | isVolunteer |
| is_portfolio | isPortfolio |
| published_at | publishedAt |
| author_nickname | authorNickname |
| author_avatar | authorAvatar |
| prep_hours | prepHours |
| dietary_summary | dietarySummary |
| team_dietary_summary | teamDietarySummary |
| can_manage | canManage |

## Helper Utilities

Created `functions/api/utils/transformResponse.ts` with:
- `toCamelCase()` - Transform snake_case to camelCase
- `toSnakeCase()` - Transform camelCase to snake_case
- `snakeToCamel()` - String conversion
- `camelToSnake()` - String conversion

## Implementation Notes

1. **Database Layer**: Keep using snake_case (Drizzle schema)
2. **API Response Layer**: Transform to camelCase at `c.json()` boundary
3. **Request Layer**: Already using camelCase (params/body) - no change needed
4. **Frontend**: Update to expect camelCase in responses

## Rollback Plan

If issues arise:
1. Revert route handler changes
2. Revert Zod schema changes  
3. Revert frontend changes
4. Database schema unchanged (always snake_case)

## Testing Strategy

1. Unit tests update to expect camelCase
2. Integration tests verify transformation
3. E2E tests verify frontend compatibility

## Timeline Estimate

- Phase 1: 2-3 hours (highest impact)
- Phase 2: 1-2 hours
- Phase 3: 2-3 hours
- Phase 4: 3-4 hours

Total: ~8-12 hours for complete migration
