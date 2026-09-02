import { createApiApp } from "../apiApp";
import inquiriesRouter from "../routes/inquiries";
import contentApprovalRouter from "../routes/contentApproval";
import profilesRouter from "../routes/profiles";
import buzzelloRouter from "../routes/buzzello";

export const coreApp = createApiApp({
  routes: [
    { path: "/api/inquiries", router: inquiriesRouter },
    { path: "/api/profiles", router: profilesRouter },
    { path: "/api/buzzello", router: buzzelloRouter },
    { path: "/api/content-admin", router: contentApprovalRouter },
  ],
});
