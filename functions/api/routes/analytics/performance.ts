import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { AppEnv, ensureAdmin } from "../../middleware";
import { Kysely } from "kysely";
import { DB } from "../../../../shared/schemas/database";

const perfRouter = new OpenAPIHono<AppEnv>();

const metricSchema = z.object({
  name: z.string(),
  value: z.number(),
  rating: z.string(),
  page: z.string(),
  timestamp: z.number(),
});

perfRouter.openapi(createRoute({
  method: 'post',
  path: '/metrics',
  request: {
    body: {
      content: { 'application/json': { schema: z.object({ metrics: z.array(metricSchema) }) } }
    }
  },
  responses: {
    200: { description: 'Metrics saved', content: { 'application/json': { schema: z.object({ received: z.number() }) } } }
  }
}), async (c) => {
  const { metrics } = c.req.valid("json");
  const db = c.get('db') as any;

  for (const metric of metrics) {
    await db.insertInto('performance_metrics').values({
      id: crypto.randomUUID(),
      metric_name: metric.name,
      value: metric.value,
      rating: metric.rating,
      page: metric.page,
      timestamp: new Date(metric.timestamp).toISOString(),
    }).execute();
  }

  return c.json({ received: metrics.length }, 200);
});

// For dashboard
perfRouter.openapi(createRoute({
  method: 'get',
  path: '/summary',
  responses: {
    200: { 
      description: 'Summary of metrics', 
      content: { 'application/json': { schema: z.object({ lcp: z.number().optional(), fid: z.number().optional(), cls: z.number().optional(), fcp: z.number().optional() }) } }
    }
  }
}), async (c) => {
  const db = c.get('db') as any;
  
  // A simple summary by taking the average of the last 100 entries for each metric.
  const results = await db.selectFrom('performance_metrics')
    .select(['metric_name'])
    .select((eb: any) => eb.fn.avg('value').as('avg_value'))
    .groupBy('metric_name')
    .execute();

  const summary: Record<string, number> = {};
  for (const row of results) {
    summary[row.metric_name.toLowerCase()] = row.avg_value as number;
  }
  
  return c.json(summary as any, 200);
});

export default perfRouter;
