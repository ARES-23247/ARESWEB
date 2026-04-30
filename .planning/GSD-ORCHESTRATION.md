# GSD Orchestration

Welcome to the ARESWEB GSD Orchestration guide. This document explains how we use Get Shit Done (GSD) to organize our work, keep our agents informed, and write high-quality code.

## The .planning Directory

Our project uses a special folder called `.planning`. This folder acts as the brain of the project.

- **ROADMAP.md**: This file lists every phase of our current milestone. It tracks what we have finished and what is coming up next.
- **PROJECT.md**: This file holds our main project goals, the core rules we follow, and a history of what we have already built.
- **STATE.md**: This file keeps track of what the AI agents are currently focusing on, any bugs they have found, and what their next steps are.
- **phases/**: Inside this folder, we keep detailed step-by-step plans and context documents for every single phase of the project.

When you ask an AI agent to build a new feature, it will automatically read these files to understand the project perfectly before it writes any code.

## Custom ARESWEB Skills

GSD uses "skills" to teach AI agents how to do specific tasks. We have built custom skills just for ARESWEB. You can find all of them in the `.agents/skills/` folder. Here are a few important ones:

### aresweb-ci
This skill teaches the AI how our Cloudflare Edge build system works. If there is an unexpected error or a testing failure, the AI reads this skill to know exactly how to fix it using our specific ESLint and Vite setups.

### aresweb-database-management
This skill holds the strict rules for our D1 database. It tells the AI how to safely change database tables, how to write fast SQL queries, and how to update our Kysely schema files.

### aresweb-documentation-readability
This skill ensures the AI writes all user-facing text and documentation at an 8th-grade reading level. This keeps our project friendly and easy to understand for everyone.

## How to Work with GSD

When you are ready to work on a new feature, you do not just start coding randomly. Instead, you follow the GSD flow:

1. **Discuss**: You run a GSD command to discuss the phase. The AI will ask you questions to figure out exactly what you want.
2. **Plan**: The AI creates a `PLAN.md` file. This tells you exactly what files it will change before it actually touches them.
3. **Execute**: Once you approve the plan, the AI writes the code.
4. **Ship**: When the code works and all tests pass, you use GSD skills to safely create a Pull Request on GitHub.

By following this process, we make sure our codebase is always clean, thoroughly tested, and perfectly documented.
