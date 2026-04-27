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
import { tbaContract } from "./tbaContract";
import { communicationsContract } from "./communicationsContract";
import { taskContract } from "./taskContract";

const c = initContract();

export const apiContract = c.router({
  sponsors: c.router(sponsorContract, { pathPrefix: "/sponsors" }),
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
  tba: c.router(tbaContract, { pathPrefix: "/tba" }),
  communications: c.router(communicationsContract, {
    pathPrefix: "/communications",
  }),
  tasks: c.router(taskContract, { pathPrefix: "/tasks" }),
});
