---
phase: 70-restore-end-to-end-type-safety
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: []
user_setup: []
---

<objective>
Restore End-to-End Type Safety by standardizing all 30+ backend routers to use `.openapi()` chaining for type propagation.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Standardize routers</name>
  <files>functions/api/routes/**/*</files>
  <action>Refactor routers to use `.openapi()` consistently to propagate types to the frontend client.</action>
  <verify>npx tsc --noEmit passes</verify>
</task>
</tasks>

<output>
Create .planning/phases/70-restore-end-to-end-type-safety/SUMMARY.md
</output>
