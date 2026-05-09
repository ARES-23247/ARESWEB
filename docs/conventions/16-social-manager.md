# Social Media Manager Architecture

> Social queue architecture and syndication. Read when working with scheduled posts or social integrations.

## Core Principles

1. **Asynchronous Dispatch** — Posts go to `social_queue`, cron dispatches
2. **Platform Agnostic** — `platforms` is JSON array: `["zulip", "instagram"]`
3. **Cross-Entity Syndication** — Events, blogs, robot mechanisms link via `linked_type`/`linked_id`

## Schema (`social_queue`)

| Field | Type |
|---|---|
| `id` | UUIDv4 |
| `content` | plaintext/markdown |
| `platforms` | JSON array |
| `scheduled_for` | ISO-8601 timestamp |
| `status` | `pending`/`processing`/`completed`/`failed`/`cancelled` |
| `created_by` | user ID (nullable) |
| `linked_type` | entity type (event, blog) |
| `linked_id` | entity UUID |
| `media_urls` | JSON array |
| `analytics` | JSON metrics object |
| `error_message` | error trace if failed |

## Lifecycle

1. **Create:** `POST /api/socialQueue` → status `pending`
2. **Cron:** Worker queries `pending` where `scheduled_for <= now`
3. **Process:** Lock → `processing`, dispatch to platforms
4. **Resolve:** `completed` or `failed` with error

## Frontend

- **SocialHub** — Dashboard for queued/historical posts
- **SocialComposer** — Modal for creating posts
- **SocialSyndicationGrid** — Attach posts to entities

## Rules

- Do NOT manually execute dispatches
- Always `JSON.stringify()` arrays before insert, `JSON.parse()` on read
- Implement rate limit handling for new platforms
