import originalApp from "../../api/[[route]]";

export const onRequest = (context: any) => {
  const url = new URL(context.request.url);
  // Rewrite /dashboard/api/* to /api/* so the original Hono router (.basePath("/api")) matches it perfectly.
  url.pathname = url.pathname.replace(/^\/dashboard\/api/, "/api");
  const newRequest = new Request(url.toString(), context.request);
  
  // Directly invoke the original app's fetch method with the correct parameters.
  // We bypass `hono/cloudflare-pages` handle() here because it would misinterpret the 
  // nested directory structure of Cloudflare Pages.
  return originalApp.fetch(newRequest, context.env, context);
};
