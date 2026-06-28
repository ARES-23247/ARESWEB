# Debugging Tools for ARESWEB

This document outlines the debugging and performance-monitoring tools available in the ARESWEB application.

## Installed Debugging Tools

### 1. TanStack Query DevTools
- **Location**: Bottom-left corner (floating button)
- **Features**:
  - Query cache inspector
  - Mutation history
  - Simulate loading/error states
  - Query performance metrics

### 2. Query Logger
- **Scope**: Development only
- **Logs**: Query lifecycle events (fetch, success, error) in the console

### 3. Slow Query Monitoring
- **Threshold**: Queries taking > 2 seconds
- **Output**: Console warning with query key and duration

---

## Browser Extensions (Recommended)

### React DevTools Profiler

**Install for your browser:**
- Chrome/Edge: [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- Firefox: [React Developer Tools](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

**Features:**
- Component tree inspection
- Props & state viewer
- Detect unnecessary re-renders
- Measure component render times
- See why components re-render

**How to use:**
1. Open DevTools (F12)
2. Go to "Profiler" tab
3. Click "Start profiling"
4. Interact with your app
5. Click "Stop profiling"
6. Analyze flame graph for performance bottlenecks

---

## Named Query Functions

Query functions are named for better stack traces in logs:
- `getTasks()` instead of `anonymous()`
- `getUsersList()` instead of `anonymous()`
- `patchUser()` instead of `anonymous()`

---

## Error Boundary

The global `ErrorBoundary` catches and displays:
- API errors (with status codes)
- React rendering errors
- Stale chunk errors (auto-reloads for service worker cache synchronization)
- Third-party blocking errors
