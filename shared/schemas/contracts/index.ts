/**
 * Shared Schemas & Types Barrel Export
 *
 * All contracts have been migrated from ts-rest to @hono/zod-openapi.
 * This file now exports only the Zod schemas and TypeScript types
 * that are consumed by the frontend.
 *
 * Backend routes use @hono/zod-openapi's createRoute() directly.
 * Frontend uses Hono's hc client (src/api/honoClient.ts) for type-safe API calls.
 */

// Re-export Zod schemas for frontend form validation and type inference
export * from './aiContract';
export * from './analyticsContract';
export * from './awardContract';
export * from './badgeContract';
export * from './commentContract';
export * from './communicationsContract';
export * from './docContract';
export * from './entityContract';
export * from './eventContract';
export * from './financeContract';
export * from './githubContract';
export * from './inquiryContract';
export * from './judgeContract';
export * from './locationContract';
export * from './logisticsContract';
export * from './mediaContract';
export * from './notificationContract';
export * from './outreachContract';
export * from './pointsContract';
export * from './postContract';
export * from './seasonContract';
export * from './settingsContract';
export * from './socialQueueContract';
export * from './sponsorContract';
export * from './storeContract';
export * from './tbaContract';
export * from './taskContract';
export * from './userContract';
export * from './zulipContract';

// Re-export common error schemas
export { standardErrors, openApiStandardErrors } from './common';
