import { initContract } from "@ts-rest/core";
import { sponsorContract } from "./sponsorContract";
import { postContract } from "./postContract";
import { docContract } from "./docContract";
import { eventContract } from "./eventContract";
import { mediaContract } from "./mediaContract";
import { notificationContract } from "./notificationContract";
import { userContract, profileContract } from "./userContract";
import { analyticsContract } from "./analyticsContract";
import { seasonContract } from "./seasonContract";
import { awardContract } from "./awardContract";
import { inquiryContract } from "./inquiryContract";
import { badgeContract } from "./badgeContract";
import { locationContract } from "./locationContract";
import { outreachContract } from "./outreachContract";
import { logisticsContract } from "./logisticsContract";
import { settingsContract } from "./settingsContract";
import { githubContract } from "./githubContract";
import { zulipContract } from "./zulipContract";
import { commentContract } from "./commentContract";
import { judgeContract } from "./judgeContract";
import { communicationsContract } from "./communicationsContract";
import { taskContract } from "./taskContract";
import { financeContract } from "./financeContract";
import { entityContract } from "./entityContract";
import { storeContract } from "./storeContract";
import { pointsContract } from "./pointsContract";
import { socialQueueContract } from "./socialQueueContract";

const c = initContract();

export const apiContract = c.router({
  sponsors: c.router(sponsorContract, { pathPrefix: "/sponsors" }),
  finance: c.router(financeContract, { pathPrefix: "/finance" }),
  entities: c.router(entityContract, { pathPrefix: "/entities" }),
  posts: c.router(postContract, { pathPrefix: "/posts" }),
  docs: c.router(docContract, { pathPrefix: "/docs" }),
  events: c.router(eventContract, { pathPrefix: "/events" }),
  media: c.router(mediaContract, { pathPrefix: "/media" }),
  notifications: c.router(notificationContract, {
    pathPrefix: "/notifications",
  }),
  users: c.router(userContract, { pathPrefix: "/users" }),
  profiles: c.router(profileContract, { pathPrefix: "/profile" }),
  analytics: c.router(analyticsContract, { pathPrefix: "/analytics" }),
  seasons: c.router(seasonContract, { pathPrefix: "/seasons" }),
  awards: c.router(awardContract, { pathPrefix: "/awards" }),
  inquiries: c.router(inquiryContract, { pathPrefix: "/inquiries" }),
  badges: c.router(badgeContract, { pathPrefix: "/badges" }),
  locations: c.router(locationContract, { pathPrefix: "/locations" }),
  outreach: c.router(outreachContract, { pathPrefix: "/outreach" }),
  logistics: c.router(logisticsContract, { pathPrefix: "/logistics" }),
  settings: c.router(settingsContract, { pathPrefix: "/settings" }),
  github: c.router(githubContract, { pathPrefix: "/github" }),
  zulip: c.router(zulipContract, { pathPrefix: "/zulip" }),
  comments: c.router(commentContract, { pathPrefix: "/comments" }),
  judges: c.router(judgeContract, { pathPrefix: "/judges" }),
  communications: c.router(communicationsContract, {
    pathPrefix: "/communications",
  }),
  tasks: c.router(taskContract, { pathPrefix: "/tasks" }),
  store: c.router(storeContract, { pathPrefix: "/store" }),
  points: c.router(pointsContract, { pathPrefix: "/points" }),
  socialQueue: c.router(socialQueueContract, { pathPrefix: "/social-queue" }),
});

// Export all contract types for frontend consumption
export type { AiContract } from './aiContract';
export type { AnalyticsContract } from './analyticsContract';
export type { AwardContract } from './awardContract';
export type { BadgeContract } from './badgeContract';
export type { CommentContract } from './commentContract';
export type { CommunicationsContract } from './communicationsContract';
export type { DocContract } from './docContract';
export type { EntityContract } from './entityContract';
export type { EventContract } from './eventContract';
export type { FinanceContract } from './financeContract';
export type { GithubContract } from './githubContract';
export type { InquiryContract } from './inquiryContract';
export type { JudgeContract } from './judgeContract';
export type { LocationContract } from './locationContract';
export type { LogisticsContract } from './logisticsContract';
export type { MediaContract } from './mediaContract';
export type { NotificationContract } from './notificationContract';
export type { OutreachContract } from './outreachContract';
export type PointsContract = typeof pointsContract;
export type { PostContract } from './postContract';
export type { SeasonContract } from './seasonContract';
export type { SettingsContract } from './settingsContract';
export type { SocialQueueContract } from './socialQueueContract';
export type { SponsorContract } from './sponsorContract';
export type { StoreContract } from './storeContract';
export type { TaskContract } from './taskContract';
export type { UserContract } from './userContract';
export type { ZulipContract } from './zulipContract';

/**
 * Type helper for inferring contract types in frontend code.
 * @example
 * import { initClient } from '@ts-rest/core';
 * import { analyticsContract, type AnalyticsContract } from '~/shared/schemas/contracts';
 *
 * const client = initClient(analyticsContract, { baseUrl: '/api' });
 * // client.trackPageView.body is now typed from AnalyticsContract
 */
export type ContractInfer<T> = T extends { _contract: infer C } ? C : T;
