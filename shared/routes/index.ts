// Export all route definitions for type-safe client usage
// NOTE: Several modules export the same names. We exclude conflicting modules
// from wildcard exports and re-export them explicitly to resolve TS2308 ambiguity.

// Modules with unique exports — safe for wildcard
export * from './analytics';
export * from './awards';
export * from './badges';
export * from './comments';
export * from './common';
export * from './entities';
export * from './events';
export * from './finance';
export * from './github';
export * from './inquiries';
export * from './judges';
export * from './locations';
export * from './logistics';
export * from './media';
export * from './notifications';
export * from './outreach';
export * from './points';
export * from './posts';
export * from './seasons';
export * from './socialQueue';
export * from './sponsors';
export * from './store';
export * from './tasks';
export * from './tba';
export * from './users';
export * from './zulip';

// communications.ts: 'getStatsRoute' collides with analytics.ts
export { sendMassEmailRoute, getStatsRoute as commsGetStatsRoute } from './communications';

// docs.ts: 'adminDetailRoute' collides with users.ts
export {
  getDocsRoute,
  searchDocsRoute,
  adminListRoute as docAdminListRoute,
  adminDetailRoute as docAdminDetailRoute,
  getDocRoute,
  deleteDocRoute,
  saveDocRoute,
  updateSortRoute,
  submitFeedbackRoute,
  getHistoryRoute,
  restoreHistoryRoute,
  approveDocRoute,
  rejectDocRoute,
  undeleteDocRoute,
  purgeDocRoute,
} from './docs';

// profiles.ts: 'badgeSchema' collides with badges.ts, 'MemberTypeEnum' collides with users.ts
export {
  authSchema,
  profileMeSchema,
  rosterMemberSchema,
  getMeRoute,
  updateMeRoute,
  getTeamRosterRoute,
  getPublicProfileRoute as profilePublicRoute,
  updateAvatarRoute,
  badgeSchema as profileBadgeSchema,
  MemberTypeEnum as profileMemberTypeEnum,
} from './profiles';

// settings.ts: 'getStatsRoute' collides with analytics.ts
export {
  getSettingsRoute,
  updateSettingsRoute,
  getPublicSettingsRoute,
  getBackupRoute,
  getStatsRoute as settingsGetStatsRoute,
} from './settings';
