/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OPENAPI SPEC GENERATOR
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a unified OpenAPI 3.1 specification from all Hono routes.
 * Includes all domain routers with proper tags, descriptions, and security schemes.
 *
 * Usage:
 *   npm run generate:openapi
 *   or
 *   tsx functions/api/docs/generate-spec.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * OpenAPI specification configuration
 */
const openApiConfig = {
  openapi: '3.1.0',
  info: {
    title: 'ARES Web Portal API',
    version: '6.8.0',
    description: `## ARES 23247 Web Portal API

**Championship-grade API for managing FIRST Robotics Competition team operations.**

### Authentication
Most endpoints require authentication via session cookies or Bearer tokens.
Public endpoints are marked with the \`public\` tag.

### Rate Limiting
- \`/inquiries/*\`: 30 requests per 60 seconds
- \`/comments/*\`: 20 requests per 60 seconds
- Other endpoints: Standard limits apply

### Response Format
All responses use JSON with camelCase property names.

### Error Codes
- \`400\` - Bad Request (validation error)
- \`401\` - Unauthorized (not authenticated)
- \`403\` - Forbidden (insufficient permissions)
- \`404\` - Not Found
- \`429\` - Too Many Requests (rate limited)
- \`500\` - Internal Server Error

---

**Built with Gracious Professionalism™** by ARES 23247`,
    contact: {
      name: 'ARES 23247',
      url: 'https://aresfirst.org',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'https://aresweb.pages.dev/api',
      description: 'Production (Cloudflare Pages)',
    },
    {
      url: 'http://localhost:8788/api',
      description: 'Local Development (Wrangler)',
    },
    {
      url: 'https://aresweb.pages.dev/dashboard/api',
      description: 'Dashboard API',
    },
  ],
  tags: [
    { name: 'auth', description: 'Authentication and session management' },
    { name: 'analytics', description: 'Usage analytics and metrics' },
    { name: 'awards', description: 'Team awards and recognition' },
    { name: 'badges', description: 'User achievement badges' },
    { name: 'comments', description: 'Content comments system' },
    { name: 'communications', description: 'Internal communications' },
    { name: 'docs', description: 'Documentation pages' },
    { name: 'entities', description: 'Organizational entities' },
    { name: 'events', description: 'Team events and meetings' },
    { name: 'finance', description: 'Financial tracking and budget' },
    { name: 'github', description: 'GitHub integration' },
    { name: 'inquiries', description: 'Contact form and inquiries' },
    { name: 'judges', description: 'Competition judge interactions' },
    { name: 'locations', description: 'Location management' },
    { name: 'logistics', description: 'Logistics and inventory' },
    { name: 'media', description: 'Media library management' },
    { name: 'notifications', description: 'User notifications' },
    { name: 'outreach', description: 'Community outreach tracking' },
    { name: 'posts', description: 'Blog and news posts' },
    { name: 'profile', description: 'User profiles' },
    { name: 'seasons', description: 'Competition seasons' },
    { name: 'settings', description: 'Application settings' },
    { name: 'sitemap', description: 'Site map generation' },
    { name: 'sponsors', description: 'Sponsor management' },
    { name: 'store', description: 'Team store management' },
    { name: 'tasks', description: 'Task management' },
    { name: 'tba', description: 'The Blue Alliance integration' },
    { name: 'users', description: 'User management' },
    { name: 'ai', description: 'AI-powered features' },
    { name: 'scouting', description: 'Competition scouting' },
    { name: 'simulations', description: 'Robot simulations' },
    { name: 'social-queue', description: 'Social media queue' },
    { name: 'webhooks', description: 'Webhook endpoints' },
    { name: 'zulip', description: 'Zulip integration' },
    { name: 'internal', description: 'Internal utilities' },
    { name: 'public', description: 'Publicly accessible endpoints' },
  ],
  components: {
    securitySchemes: {
      sessionAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'better-auth.session_token',
        description: 'Session cookie authentication (managed by better-auth)',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Bearer token authentication (API tokens)',
      },
    },
    schemas: {
      // Common error response
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message',
          },
          code: {
            type: 'string',
            description: 'Machine-readable error code',
          },
        },
        required: ['error'],
      },
      // Pagination metadata
      PaginationMeta: {
        type: 'object',
        properties: {
          total: {
            type: 'integer',
            description: 'Total number of items',
          },
          limit: {
            type: 'integer',
            description: 'Items per page',
          },
          offset: {
            type: 'integer',
            description: 'Number of items skipped',
          },
        },
      },
    },
  },
} as const;

/**
 * Export the config for use in the main API router
 */
export { openApiConfig };

/**
 * Note: The actual OpenAPI spec is generated dynamically by Hono's OpenAPIHono
 * when you access the /openapi.json endpoint. This file provides the configuration
 * for that endpoint and can be used to generate static docs.
 *
 * To generate a static OpenAPI JSON file, the API server must be running:
 *   curl http://localhost:8788/api/openapi.json > openapi.json
 */
