# Phase 47: Loading Strategy Context

**Goal**: Route-based chunk splitting and critical resource preloading.

## Current State
- The frontend framework is React with Vite.
- All routes are registered in `src/App.tsx`.
- Critical resources like fonts and CSS are required early in the load cycle to prevent layout shifts.

## Requirements
- Split javascript chunks per route so the initial payload is small.
- Preload critical resources (like fonts) in the document head.
