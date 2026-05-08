-- ────────────────────────────────────────────────────────────────────────────────
-- ARES Web Portal - Test Data Seed for D1 Database
--
-- IMPORTANT: This seeds the PRODUCTION ares-db with test data.
--
-- Cloudflare Pages preview deployments share the same D1 binding as production,
-- so tests run against the production database. All test data is prefixed with
-- 'test-' or uses known IDs to avoid conflicts with production data.
--
-- To properly separate test/preview data, consider creating a separate D1 database
-- (e.g., ares-db-preview) and configuring preview deployments to use it.
--
-- Usage:
--   Remote (production):  wrangler d1 execute ares-db --remote --file=scripts/seed-test-data.sql
--   Local:                wrangler d1 execute ares-db --local --file=scripts/seed-test-data.sql
--   NPM script:           npm run db:seed:remote
-- ────────────────────────────────────────────────────────────────────────────────

-- ────────────────────────────────────────
-- Clean existing test data (to avoid conflicts on re-seed)
-- ──────────────────────────────────────────

-- Delete in reverse dependency order to avoid FK violations.
-- Child tables with FK → user must be cleaned BEFORE the user table.
-- Tables with FK → events must be cleaned BEFORE events.
-- Tables with FK → seasons must be cleaned BEFORE seasons.

-- Better Auth session/account tables (FK → user)
DELETE FROM session WHERE userId LIKE 'test-%' OR userId = 'admin-user';
DELETE FROM account WHERE userId LIKE 'test-%' OR userId = 'admin-user';

-- Event signups (FK → events, FK → user)
DELETE FROM event_signups WHERE user_id LIKE 'test-%' OR user_id = 'admin-user';

-- Task assignments (FK → tasks)
DELETE FROM task_assignments WHERE user_id LIKE 'test-%' OR user_id = 'admin-user';

-- User badges (FK → user, FK → badges)
DELETE FROM user_badges WHERE user_id LIKE 'test-%' OR user_id = 'admin-user';

-- User profiles (FK → user)
DELETE FROM user_profiles WHERE user_id LIKE 'test-%' OR user_id = 'admin-user';

-- Tasks (FK → user via created_by)
DELETE FROM tasks WHERE created_by LIKE 'test-%' OR created_by = 'admin-user' OR id LIKE 'test-%';

-- Simulations (FK → user via author_id)
DELETE FROM simulations WHERE author_id LIKE 'test-%' OR author_id = 'admin-user' OR id LIKE 'sim-%';

-- Now safe to delete users (all child FK references removed above)
DELETE FROM user WHERE id LIKE 'test-%' OR id = 'admin-user';

-- Independent tables (no user FK, safe to clean anytime)
DELETE FROM badges WHERE id LIKE 'test-%';
DELETE FROM sponsors WHERE id LIKE 'test-%';
DELETE FROM locations WHERE id LIKE 'test-%';
DELETE FROM posts WHERE slug LIKE 'test-%';
DELETE FROM events WHERE id LIKE 'test-%';
DELETE FROM docs WHERE slug LIKE 'test-%';

-- Clean AUTOINCREMENT tables that lack ON CONFLICT (use known identifiers)
DELETE FROM awards WHERE event_name IN ('Texas FTC Qualifier', 'Texas FTC Championship', 'Lone Star Regional');
DELETE FROM outreach_logs WHERE cf_email = 'admin@ares.org';
DELETE FROM products WHERE id IN ('team-t-shirt', 'team-hoodie', 'team-pin');

-- ────────────────────────────────────────
-- Seasons (must be seeded BEFORE events, awards, outreach_logs that FK → seasons)
-- ──────────────────────────────────────────

INSERT INTO seasons (start_year, end_year, challenge_name, robot_name, robot_description, summary, status, is_deleted)
VALUES
  (2024, 2025, 'INTO THE DEEP', 'AresBot Mk4', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Our 2024-2025 robot."}]}]}', 'Our 2024-2025 season robot.', 'published', 0),
  (2025, 2026, 'Upcoming Game', NULL, NULL, 'Coming soon...', 'published', 0)
ON CONFLICT(start_year) DO UPDATE SET
  challenge_name = excluded.challenge_name,
  robot_name = excluded.robot_name;

-- ────────────────────────────────────────
-- Users
-- ──────────────────────────────────────────

-- Admin user (primary test user)
INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt, role)
VALUES (
  'admin-user',
  'Admin User',
  'admin@ares.org',
  1,
  1704067200000,
  1704067200000,
  'admin'
) ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  email = excluded.email,
  role = excluded.role;

-- Admin user profile
INSERT INTO user_profiles (
  user_id, first_name, last_name, nickname, member_type,
  show_on_about, grade_year, subteams, bio
) VALUES (
  'admin-user',
  'Admin',
  'User',
  'Admin User',
  'mentor',
  1,
  '2024',
  '["programming"]',
  'Test admin user for E2E testing.'
) ON CONFLICT(user_id) DO UPDATE SET
  nickname = excluded.nickname,
  member_type = excluded.member_type;

-- Additional test users
INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt, role)
VALUES
  ('test-user-1', 'Test Student', 'student@ares.org', 1, 1704067200000, 1704067200000, 'user'),
  ('test-user-2', 'Test Mentor', 'mentor@ares.org', 1, 1704067200000, 1704067200000, 'mentor')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  email = excluded.email,
  role = excluded.role;

-- Test user profiles
INSERT INTO user_profiles (user_id, first_name, last_name, nickname, member_type, show_on_about, grade_year)
VALUES
  ('test-user-1', 'Test', 'Student', 'Student User', 'student', 1, '2025'),
  ('test-user-2', 'Test', 'Mentor', 'Mentor User', 'mentor', 1, NULL)
ON CONFLICT(user_id) DO UPDATE SET
  nickname = excluded.nickname,
  member_type = excluded.member_type;

-- ────────────────────────────────────────
-- Badges
-- ──────────────────────────────────────────

INSERT INTO badges (id, name, description, icon, color_theme, created_at)
VALUES
  ('outreach-mvp', 'Outreach MVP', 'Awarded to members who attain top 3 in outreach hours.', 'Award', 'text-ares-gold', datetime('now')),
  ('safety-certified', 'Safety Certified', 'Completed all safety training modules.', 'Shield', 'text-green-500', datetime('now')),
  ('programming-excellence', 'Programming Excellence', 'Awarded for outstanding code contributions.', 'Code', 'text-blue-500', datetime('now')),
  ('test-badge', 'Test Badge', 'A test badge for E2E testing.', 'Award', 'text-ares-gold', datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description;

-- Award some badges to test users
INSERT INTO user_badges (user_id, badge_id, awarded_by, awarded_at)
VALUES
  ('admin-user', 'outreach-mvp', 'system', datetime('now')),
  ('admin-user', 'programming-excellence', 'system', datetime('now')),
  ('test-user-1', 'safety-certified', 'admin-user', datetime('now'))
ON CONFLICT(user_id, badge_id) DO NOTHING;

-- ────────────────────────────────────────
-- Sponsors
-- ──────────────────────────────────────────

INSERT INTO sponsors (id, name, tier, logo_url, website_url, is_active, created_at)
VALUES
  ('nasa', 'NASA', 'Titanium', 'https://example.com/nasa-logo.png', 'https://nasa.gov', 1, datetime('now')),
  ('google', 'Google', 'Gold', 'https://example.com/google-logo.png', 'https://google.com', 1, datetime('now')),
  ('local-business', 'Local Hardware Store', 'Bronze', NULL, 'https://localhardware.com', 1, datetime('now')),
  ('software-donation', 'Software Company', 'In-Kind', NULL, 'https://softwareco.com', 1, datetime('now')),
  ('test-sponsor', 'Test Sponsor', 'Gold', NULL, NULL, 1, datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  tier = excluded.tier;

-- ────────────────────────────────────────
-- Locations
-- ──────────────────────────────────────────

INSERT INTO locations (id, name, address, maps_url, is_deleted)
VALUES
  ('mars-workspace', 'Mars Workspace', '123 Robotics Lane, Plano, TX 75074', 'https://www.google.com/maps/search/?api=1&query=123%20Robotics%20Lane%2C%20Plano%2C%20TX%2075074', 0),
  ('competition-arena', 'Competition Arena', '4500 W. Illinois St, Midland, TX 79703', 'https://www.google.com/maps/search/?api=1&query=4500%20W.%20Illinois%20St%2C%20Midland%2C%20TX%2079703', 0),
  ('community-center', 'Community Center', '1500 Avenue J, Huntsville, TX 77320', 'https://www.google.com/maps/search/?api=1&query=1500%20Avenue%20J%2C%20Huntsville%2C%20TX%2077320', 0),
  ('test-location', 'Test Location', '123 Test Street, Test City, TX 75001', 'https://www.google.com/maps/search/?api=1&query=123%20Test%20Street%2C%20Test%20City%2C%20TX%2075001', 0)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  address = excluded.address;

-- ────────────────────────────────────────
-- Tasks
-- ──────────────────────────────────────────

INSERT INTO tasks (id, title, description, status, priority, subteam, sort_order, assigned_to, created_by, due_date, created_at, updated_at)
VALUES
  ('test-task', 'Test Task', NULL, 'todo', 'normal', NULL, 0, NULL, 'admin-user', NULL, datetime('now'), datetime('now')),
  ('existing-task', 'Existing Task', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"This is a test task description."}]}]}', 'in-progress', 'high', 'programming', 1, 'admin-user', 'admin-user', datetime('now', '+7 days'), datetime('now', '-1 day'), datetime('now')),
  ('task-todo-1', 'Fix navigation bug', NULL, 'todo', 'high', 'programming', 0, 'admin-user', 'admin-user', datetime('now', '+3 days'), datetime('now', '-2 days'), datetime('now')),
  ('task-in-progress-1', 'Update sponsor logos', NULL, 'in-progress', 'normal', 'marketing', 1, 'test-user-1', 'admin-user', datetime('now', '+5 days'), datetime('now', '-1 day'), datetime('now')),
  ('task-done-1', 'Set up new laptop', NULL, 'done', 'low', NULL, 0, 'test-user-1', 'test-user-2', datetime('now', '-2 days'), datetime('now', '-5 days'), datetime('now', '-2 days'))
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  status = excluded.status,
  priority = excluded.priority;

-- Task assignments
INSERT INTO task_assignments (task_id, user_id)
VALUES
  ('existing-task', 'admin-user'),
  ('task-in-progress-1', 'test-user-1'),
  ('task-done-1', 'test-user-1')
ON CONFLICT(task_id, user_id) DO NOTHING;

-- ────────────────────────────────────────
-- Simulations
-- ──────────────────────────────────────────

INSERT INTO simulations (id, name, description, files, author_id, is_public, created_at, updated_at)
VALUES
  ('sim-1', 'Arm Kinematics Gravity Model', 'A simulation for modeling arm kinematics under gravity.', '{"SimComponent.tsx":"export default function ArmKgSim() { return <div>Arm Kinematics</div>; }"}', 'admin-user', 1, '2024-01-15T00:00:00.000Z', '2024-01-15T00:00:00.000Z'),
  ('sim-2', 'Elevator PID Tuning', 'Tune elevator PID parameters interactively.', '{"SimComponent.tsx":"export default function ElevatorPidSim() { return <div>Elevator PID</div>; }"}', 'admin-user', 1, '2024-02-01T00:00:00.000Z', '2024-02-01T00:00:00.000Z'),
  ('sim-3', 'Swerve Kinematics Playground', 'Interactive swerve drive kinematics visualization.', '{"SimComponent.tsx":"export default function SwerveSim() { return <div>Swerve Kinematics</div>; }"}', 'admin-user', 0, '2024-02-15T00:00:00.000Z', '2024-02-15T00:00:00.000Z')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  is_public = excluded.is_public;

-- ────────────────────────────────────────
-- Blog Posts
-- ──────────────────────────────────────────

INSERT INTO posts (slug, title, date, snippet, thumbnail, author, cf_email, ast, status, is_deleted)
VALUES
  ('test-blog-post', 'Test Blog Post', '2024-01-15', 'A test blog post for E2E testing.', NULL, 'Admin User', 'admin@ares.org', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"This is a test blog post."}]}]}', 'published', 0),
  ('welcome-to-ares', 'Welcome to ARES 23247', '2024-01-01', 'Welcome to our team website!', NULL, 'Admin User', 'admin@ares.org', '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Welcome to ARES 23247"}]},{"type":"paragraph","content":[{"type":"text","text":"We are a FIRST Robotics Competition team."}]}]}', 'published', 0)
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  status = excluded.status;

-- ────────────────────────────────────────
-- Events
-- ──────────────────────────────────────────

INSERT INTO events (id, title, date_start, date_end, location, description, status, category, is_deleted, season_id)
VALUES
  ('test-event-1', 'Test Competition', datetime('now', '+7 days'), datetime('now', '+9 days'), 'competition-arena', 'A test competition event.', 'published', 'competition', 0, 2024),
  ('test-event-2', 'Team Meeting', datetime('now', '+3 days'), NULL, 'mars-workspace', 'Regular team meeting.', 'published', 'internal', 0, 2024),
  ('outreach-event-1', 'Community Demo', datetime('now', '+14 days'), datetime('now', '+14 days'), 'community-center', 'Robotics demonstration for community.', 'published', 'outreach', 0, 2024)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  status = excluded.status;

-- ────────────────────────────────────────
-- Documentation
-- ──────────────────────────────────────────

INSERT INTO docs (slug, title, category, sort_order, description, content, status, is_deleted)
VALUES
  ('test-doc', 'Test Documentation', 'General', 0, 'A test document for E2E testing.', '# Test Documentation\n\nThis is a test document.', 'published', 0),
  ('getting-started', 'Getting Started', 'General', 1, 'Getting started with ARES.', '# Getting Started\n\nWelcome to the team!', 'published', 0)
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  status = excluded.status;

-- ────────────────────────────────────────
-- Awards (AUTOINCREMENT — use INSERT OR IGNORE to prevent duplicates on re-seed)
-- ──────────────────────────────────────────

INSERT INTO awards (title, event_name, date, description, icon_type, season_id, is_deleted)
VALUES
  ('Inspire Award', 'Texas FTC Qualifier', '2024-02-15', 'Awarded for excellence in robotic design and documentation.', 'trophy', 2024, 0),
  ('Winning Alliance', 'Texas FTC Championship', '2024-03-01', 'First place alliance captain.', 'trophy', 2024, 0),
  ('Design Award', 'Lone Star Regional', '2024-03-15', 'Recognized for innovative robot design.', 'award', 2024, 0);

-- ────────────────────────────────────────
-- Outreach Logs (AUTOINCREMENT — cleaned above by cf_email)
-- ──────────────────────────────────────────

INSERT INTO outreach_logs (title, date, location, hours, people_reached, students_count, impact_summary, cf_email, is_deleted, season_id)
VALUES
  ('Elementary School Demo', '2024-01-10', 'Local Elementary School', 3, 50, 10, 'Demonstrated robot to elementary students.', 'admin@ares.org', 0, 2024),
  ('Library STEM Night', '2024-02-20', 'Public Library', 2, 75, 8, 'Ran STEM activities at library event.', 'admin@ares.org', 0, 2024);

-- ────────────────────────────────────────
-- Products (Store)
-- ──────────────────────────────────────────

INSERT INTO products (id, name, description, price_cents, image_url, active)
VALUES
  ('team-t-shirt', 'ARES Team T-Shirt', 'Official team t-shirt with ARES 23247 logo.', 2500, 'https://example.com/tshirt.jpg', 1),
  ('team-hoodie', 'ARES Team Hoodie', 'Warm team hoodie for competition season.', 4500, 'https://example.com/hoodie.jpg', 1),
  ('team-pin', 'ARES Lapel Pin', 'Collectible team pin.', 500, 'https://example.com/pin.jpg', 1)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  price_cents = excluded.price_cents;

-- ────────────────────────────────────────
-- Settings
-- ──────────────────────────────────────────

INSERT INTO settings (key, value, updated_at)
VALUES
  ('current_season', '2024', datetime('now')),
  ('registration_open', 'true', datetime('now')),
  ('contact_email', 'contact@ares23247.org', datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value;

-- ──────────────────────────────────────────
-- Seed Complete
-- ──────────────────────────────────────────
