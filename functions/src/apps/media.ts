import { createApiApp } from "../apiApp";
import aiRouter from "../routes/ai";
import driveRouter from "../routes/drive";
import photosRouter from "../routes/photos";
import videosRouter from "../routes/videos";

export const mediaApp = createApiApp({
  enableLargePhotoUpload: true,
  routes: [
    { path: "/api/photos", router: photosRouter },
    { path: "/api/ai", router: aiRouter },
    { path: "/api/videos", router: videosRouter },
    { path: "/api/drive", router: driveRouter },
  ],
});
