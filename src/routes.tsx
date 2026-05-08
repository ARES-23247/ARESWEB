import React from "react";

export interface RouteConfig {
  path: string;
  component: React.LazyExoticComponent<React.FC<{}>>;
}

const routes: RouteConfig[] = [
  { path: "/", component: React.lazy(() => import("./pages/Home")) },
  { path: "/about", component: React.lazy(() => import("./pages/About")) },
  { path: "/seasons", component: React.lazy(() => import("./pages/Seasons")) },
  { path: "/outreach", component: React.lazy(() => import("./pages/Outreach")) },
  { path: "/blog", component: React.lazy(() => import("./pages/Blog")) },
  { path: "/blog/:slug", component: React.lazy(() => import("./pages/BlogPost")) },
  { path: "/gallery", component: React.lazy(() => import("./pages/Gallery")) },
  { path: "/events", component: React.lazy(() => import("./pages/Events")) },
  { path: "/events/:id", component: React.lazy(() => import("./pages/EventDetail")) },
  { path: "/dashboard/*", component: React.lazy(() => import("./pages/Dashboard")) },
  { path: "/login", component: React.lazy(() => import("./pages/Login")) },
  { path: "/profile/:userId", component: React.lazy(() => import("./pages/ProfilePage")) },
  { path: "/tech-stack", component: React.lazy(() => import("./pages/TechStack")) },
  { path: "/accessibility", component: React.lazy(() => import("./pages/Accessibility")) },
  { path: "/privacy", component: React.lazy(() => import("./pages/Privacy")) },
  { path: "/docs", component: React.lazy(() => import("./pages/Docs")) },
  { path: "/docs/:slug", component: React.lazy(() => import("./pages/Docs")) },
  { path: "/developers/api", component: React.lazy(() => import("./pages/DeveloperApi")) },
  { path: "/bug-report", component: React.lazy(() => import("./pages/BugReport")) },
  { path: "/sponsors", component: React.lazy(() => import("./pages/Sponsors")) },
  { path: "/sponsors/roi/:tokenId", component: React.lazy(() => import("./pages/SponsorROI")) },
  { path: "/join", component: React.lazy(() => import("./pages/Join")) },
  { path: "/judges", component: React.lazy(() => import("./pages/JudgesHub")) },
  { path: "/judges/print", component: React.lazy(() => import("./pages/PrintPortfolio")) },
  { path: "/leaderboard", component: React.lazy(() => import("./pages/Leaderboard")) },
  { path: "/store", component: React.lazy(() => import("./pages/Store")) },
  { path: "/academy", component: React.lazy(() => import("./pages/Academy")) },
  { path: "/academy/:slug", component: React.lazy(() => import("./pages/Academy")) },
  { path: "/sim-runner", component: React.lazy(() => import("./pages/SimRunner")) },
  { path: "*", component: React.lazy(() => import("./pages/NotFound")) },
];

export default routes;
