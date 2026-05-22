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

-- Award some badges to test users (cleanup above removes these, so plain INSERT is safe)
INSERT INTO user_badges (user_id, badge_id, awarded_by, awarded_at)
VALUES
  ('admin-user', 'outreach-mvp', 'system', datetime('now')),
  ('admin-user', 'programming-excellence', 'system', datetime('now')),
  ('test-user-1', 'safety-certified', 'admin-user', datetime('now'));

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

INSERT INTO docs (slug, title, category, sort_order, description, content, status, is_deleted, display_in_math_corner)
VALUES
  ('test-doc', 'Test Documentation', 'General', 0, 'A test document for E2E testing.', '# Test Documentation\n\nThis is a test document.', 'published', 0, 0),
  ('getting-started', 'Getting Started', 'General', 1, 'Getting started with ARES.', '# Getting Started\n\nWelcome to the team!', 'published', 0, 0),
  (
    'linear-equations',
    'Understanding Linear Equations',
    'Mathematics',
    2,
    'Learn how to represent lines mathematically using three core algebraic forms with an interactive, live coordinate system graph.',
    '# Linear Equations in 2D Space

Linear equations describe straight lines in a 2D coordinate grid. Mathematicians and roboticists use three fundamental representations depending on the given parameters.

### Interactive Exploration

Use the simulator below to drag points and sliders in real-time. Notice how adjusting parameters in one form instantly transforms the equations in the other two formats!

<linearequations />

## 1. Slope-Intercept Form: y = mx + b

Ideal when you know how steep the line is and where it crosses the vertical axis.
- **m (Slope)**: The rate of change ("rise over run").
- **b (Y-intercept)**: The point (0, b) where the line intersects the Y-axis.

## 2. Standard Form: Ax + By = C

Useful for finding both X and Y intercepts easily and representing vertical lines (B = 0).
- **A, B, C**: Must be integers.
- **Intercepts**: X-intercept is (C/A, 0) and Y-intercept is (0, C/B).

## 3. Point-Slope Form: y - y1 = m(x - x1)

Perfect when you know a single coordinate the line passes through and its steepness.
- **m**: The slope.
- **(x1, y1)**: A known anchor point on the line.',
    'published',
    0,
    1
  ),
  (
    'trig-basics',
    'Trigonometry Basics: The Unit Circle',
    'Mathematics',
    3,
    'Explore the basics of Sine, Cosine, and Tangent on an interactive unit circle, and learn how we convert between Degrees and Radians.',
    '# Trigonometry Basics: The Unit Circle

Trigonometry is the study of how angles relate to side lengths in triangles. In robotics and graphics, we visualize this using a **Unit Circle**—a circle with a radius of exactly 1 centered at the origin (0, 0).

### Interactive Exploration

Drag the glowing coordinate handle around the circle perimeter. Observe how Sine (vertical height), Cosine (horizontal width), and Tangent (tangent intersection slope) change in real time!

<trigbasics />

## 1. Degrees vs. Radians

How do we measure rotation?
- **Degrees (°)**: A full circle is divided into **360 parts**. Why 360? Historical reasons! Ancient astronomers used it because 360 is divisible by many numbers.
- **Radians (rad)**: A natural mathematical unit of angle. One radian is the angle formed when we wrap the circle''s radius along its outer edge (arc). A full circle has a circumference of $2\pi R$, which means a full rotation is exactly **$2\pi$ radians**!

### Conversion Formulas:
- $\text{Radians} = \text{Degrees} \times \frac{\pi}{180}$
- $\text{Degrees} = \text{Radians} \times \frac{180}{\pi}$

---

## 2. The Core Ratios

When the radius of our circle is $R = 1$, the coordinates of the terminal point on the circle edge are defined by:
- **Cosine ($\cos\theta$)**: The horizontal X-coordinate. It measures the adjacent width of the triangle.
- **Sine ($\sin\theta$)**: The vertical Y-coordinate. It measures the opposite height of the triangle.
- **Tangent ($\tan\theta$)**: The slope of the terminal line. It is calculated as $\frac{\sin\theta}{\cos\theta} = \frac{y}{x}$. Tangent is undefined when the line is perfectly vertical ($90^\circ$ and $270^\circ$).',
    'published',
    0,
    1
  ),
  (
    'trig-inverse',
    'Inverse Trigonometry: Ratios to Angles',
    'Mathematics',
    4,
    'Learn about arcsin, arccos, and arctan, and understand the mathematical domain and range restrictions that keep inverse trig functions valid.',
    '# Inverse Trigonometry: Ratios to Angles

Standard trigonometric functions take an **Angle** and return a **Ratio** (like height or width). Inverse trigonometric functions do the exact opposite: they take a **Ratio** and find the original **Angle**.

### Interactive Exploration

Select a function and drag the ratio slider or the grid handle. See what output angle is solved in real time!

<triginverse />

## 1. The Inverse Notations

Inverse trigonometric operations can be written in two ways:
- **$\sin^{-1}(y)$**, **$\cos^{-1}(x)$**, **$\tan^{-1}(t)$** (read as "sine-inverse", "cosine-inverse", "tangent-inverse"). Note: The $-1$ exponent represents the inverse function, NOT a reciprocal ($1/\sin$)!
- **$\arcsin(y)$**, **$\arccos(x)$**, **$\arctan(t)$** (read as "arc-sine", "arc-cosine", "arc-tangent"). The prefix "arc" refers to the arc length along the unit circle.

---

## 2. The Restricted Range Rule

If we ask a calculator to solve $\sin^{-1}(0.5)$, it will output $30^\circ$ (or $\pi/6$ rad). However, on a full unit circle, multiple angles share the exact same sine ratio! For example, $\sin(150^\circ) = 0.5$ and $\sin(390^\circ) = 0.5$.

In mathematics, a **function** is only valid if each unique input gives exactly **one** output. To make inverse trig functions mathematically valid, mathematicians restrict their allowed outputs to standard **Principal Ranges**:

- **$\arcsin(y)$**: Restricted to the right half of the circle ($[-90^\circ, 90^\circ]$ or $[-\pi/2, \pi/2]$).
- **$\arccos(x)$**: Restricted to the top half of the circle ($[0^\circ, 180^\circ]$ or $[0, \pi]$).
- **$\arctan(t)$**: Restricted to the right half of the circle (excluding vertical bounds, $( -90^\circ, 90^\circ )$ or $( - \pi/2, \pi/2 )$).',
    'published',
    0,
    1
  ),
  (
    'trig-robotics',
    'Trigonometry in Robotics: Planar Kinematics',
    'Mathematics',
    5,
    'See how robotics teams use sin, cos, atan2, and the Law of Cosines to solve Forward and Inverse Kinematics for a 2-joint robotic arm.',
    '# Trigonometry in Robotics: Planar Kinematics

How do robotic arms move? Whether it''s a heavy manufacturing crane or a FIRST® Tech Challenge (FTC) team lifting an intake claw, robots rely heavily on trigonometry to navigate 2D and 3D coordinate space.

We represent a standard two-joint robotic arm operating in a flat plane as a **2-DOF (Degree of Freedom) Planar Arm**.

### Interactive Kinematics Simulator

Toggle between **Inverse Kinematics** and **Forward Kinematics** modes. Drag the red target coordinate handle or adjust length/angle sliders to solve the mechanical joints in real time!

<trigrobotics />

## 1. Forward Kinematics (FK)

**Forward Kinematics** means calculating the spatial coordinate $(x,y)$ of the hand (end-effector) from known motor joint angles ($\theta_1$ and $\theta_2$).

By using basic right-triangle trigonometry, we find the coordinate offsets of each link:
- Link 1 (length $L_1$) ends at coordinate:
  $$x_1 = L_1 \cos(\theta_1)$$
  $$y_1 = L_1 \sin(\theta_1)$$
- Link 2 (length $L_2$) is angled at $(\theta_1 + \theta_2)$ relative to the base, ending at:
  $$x_2 = x_1 + L_2 \cos(\theta_1 + \theta_2)$$
  $$y_2 = y_1 + L_2 \sin(\theta_1 + \theta_2)$$

Combined, we get the complete Forward Kinematics formulas:
- **$x = L_1 \cos(\theta_1) + L_2 \cos(\theta_1 + \theta_2)$**
- **$y = L_1 \sin(\theta_1) + L_2 \sin(\theta_1 + \theta_2)$**

---

## 2. Inverse Kinematics (IK)

**Inverse Kinematics** is the opposite, and is much more useful in real-world robotics! It means starting with a target coordinate $(x,y)$ where we want the claw to grab, and calculating the necessary motor angles ($\theta_1$ and $\theta_2$) to reach it.

To solve this, robotics libraries (like **ARESLib**) use a combination of Pythagoras, the double-argument **$\text{atan2}(y, x)$** function, and the **Law of Cosines**:

1. **Solve the Elbow Angle ($\theta_2$)**:
   Using the Law of Cosines on the triangle formed by $L_1$, $L_2$, and the target distance $D = \sqrt{x^2+y^2}$, we solve for $\theta_2$:
   $$\cos(\theta_2) = \frac{x^2 + y^2 - L_1^2 - L_2^2}{2 L_1 L_2}$$
   $$\theta_2 = \arccos\left(\cos(\theta_2)\right)$$

2. **Solve the Base/Shoulder Angle ($\theta_1$)**:
   We find the overall angle to the target coordinate $\alpha = \text{atan2}(y, x)$ and subtract the interior triangle angle $\beta$:
   $$\theta_1 = \text{atan2}(y, x) - \arccos\left(\frac{x^2 + y^2 + L_1^2 - L_2^2}{2 L_1 \sqrt{x^2 + y^2}}\right)$$

### Singularities & Dead Zones
What happens if you try to reach a coordinate that is too far away ($x^2 + y^2 > (L_1+L_2)^2$)? The arm cannot stretch any further. This is a **reach singularity**. Real robot controllers must detect these states and safely clamp the target coordinates to avoid driving motors into invalid math ranges.',
    'published',
    0,
    1
  )
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  content = excluded.content,
  display_in_math_corner = excluded.display_in_math_corner,
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
