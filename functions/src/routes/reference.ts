import express from "express";

const router = express.Router();

router.get("/", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>ARES API Reference</title>
  </head>
  <body style="font-family:system-ui;background:#0b0b0d;color:#f5f5f5;padding:2rem">
    <h1>ARES API Reference</h1>
    <p>The interactive OpenAPI specification is not currently published.</p>
    <p><a href="/developer-api" target="_top" style="color:#f4b942">Return to the developer API guide</a></p>
  </body>
</html>`);
});

export default router;
