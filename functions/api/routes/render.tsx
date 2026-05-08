/** @jsxImportSource hono/jsx */
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../middleware";

import type { Child } from "hono/jsx";

export const renderRouter = new OpenAPIHono<AppEnv>();

const Layout = ({ title, children }: { title: string; children: Child }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body className="bg-zinc-950 text-zinc-100 flex items-center justify-center min-h-screen font-sans">
      <main className="max-w-2xl w-full p-8 bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800">
        {children}
      </main>
    </body>
  </html>
);

// A simple backend-rendered dynamic template (e.g., for email receipts or OpenGraph previews)
renderRouter.get("/receipt/:id", (c) => {
  const { id } = c.req.param();
  const date = new Date().toLocaleDateString();

  return c.html(
    <Layout title={`Receipt #${id} - ARESWEB`}>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black text-yellow-500 uppercase tracking-widest mb-2">ARES 23247</h1>
        <p className="text-zinc-400">Transaction Receipt</p>
      </div>
      
      <div className="bg-zinc-950 p-6 rounded-xl border border-zinc-800 mb-8">
        <div className="flex justify-between border-b border-zinc-800 pb-4 mb-4">
          <span className="text-zinc-500 font-mono text-sm">ORDER ID</span>
          <span className="font-mono text-zinc-300">{id}</span>
        </div>
        <div className="flex justify-between border-b border-zinc-800 pb-4 mb-4">
          <span className="text-zinc-500 font-mono text-sm">DATE</span>
          <span className="font-mono text-zinc-300">{date}</span>
        </div>
        <div className="flex justify-between items-center pt-2">
          <span className="text-zinc-400">Total Contribution</span>
          <span className="text-2xl font-bold text-green-400">$250.00</span>
        </div>
      </div>

      <div className="text-center text-sm text-zinc-500">
        <p>Thank you for supporting First Tech Challenge Team 23247!</p>
      </div>
    </Layout>
  );
});

export default renderRouter;
