---
title: Architecture Decision - Science Corner Infrastructure
date: 2026-05-01
---

# Architecture Decision: Science Corner Infrastructure

**Decision:**
The Science Corner will be powered by the existing `SimulationPlayground.tsx` live-code infrastructure rather than building standalone, hardcoded React pages or using external iframes.

**Reasoning:**
1. **Zero Friction:** Developers can write and save experiments directly in the browser without cloning the repo, running npm install, or waiting for Cloudflare builds.
2. **Massive Flex:** Showing sponsors and judges that the team built an interactive, browser-based IDE where you can write code and see it execute in real-time is a much stronger technical flex than a static page.
3. **Outreach Engagement:** Younger students can tweak the code right there in the browser and instantly see the results, making the site highly interactive for STEM outreach.

**Implementation Note:**
The Simulation Sandbox component may need to be slightly generalized to support "generic" web templates alongside the robotics-specific ones.
