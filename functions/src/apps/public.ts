import { createApiApp } from "../apiApp";
import calendarRouter from "../routes/calendar";
import financeRouter from "../routes/finance";
import outreachRouter from "../routes/outreach";
import referenceRouter from "../routes/reference";
import robotsRouter from "../routes/robots";
import sitemapRouter from "../routes/sitemap";
import sponsorsRouter from "../routes/sponsors";
import seasonsRouter, { awardsRouter } from "../routes/seasons";
import storeRouter from "../routes/store";
import tournamentsRouter from "../routes/tournaments";
import ogRouter from "../routes/og";
import announcementsRouter from "../routes/announcements";
import appCheckCanaryRouter from "../routes/appCheckCanary";
import feedRouter from "../routes/feed";
import contentRouter from "../routes/content";

export const publicApp = createApiApp({ routes: [
  { path: "/api/app-check", router: appCheckCanaryRouter },
  { path: "/api/announcements", router: announcementsRouter },
  { path: "/api/calendar", router: calendarRouter },
  { path: "/api/content", router: contentRouter },
  { path: "/api/sponsors", router: sponsorsRouter },
  { path: "/api/seasons", router: seasonsRouter },
  { path: "/api/awards", router: awardsRouter },
  { path: "/api/outreach", router: outreachRouter },
  { path: "/api/tournaments", router: tournamentsRouter },
  { path: "/api/robots", router: robotsRouter },
  { path: "/api/store", router: storeRouter },
  { path: "/api/finance", router: financeRouter },
  { path: "/api/reference", router: referenceRouter },
  { path: "/api/og", router: ogRouter },
  { path: "/sitemap.xml", router: sitemapRouter },
  { path: "/api/sitemap.xml", router: sitemapRouter },
  { path: "/feed.xml", router: feedRouter },
  { path: "/api/feed.xml", router: feedRouter },
] });
