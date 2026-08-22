import express from "express";

const router = express.Router();

/**
 * Mutation-free production canary. The shared API middleware verifies App
 * Check before this handler runs; the endpoint intentionally reads and writes
 * no application data.
 */
router.post("/canary", (_req, res) => {
  res.status(204).end();
});

export default router;
