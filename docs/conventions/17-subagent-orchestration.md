# Subagent Orchestration

> Rules for spawning and managing subagents. Read before delegating work to browser subagents or parallel audits.

## Scoping & Delegation

- **Single Responsibility:** One focused task per subagent
- **Don't use browser for APIs:** Use native tools (read_url_content, terminal) when possible
- **Clear Return Conditions:** Define exact stop conditions in prompt

## Browser Subagents

- **Only for:** JavaScript execution, cookie/session state, DOM rendering, visual validation
- **RecordingName:** Required for UI validation artifacts (WebP video)
- **Session Resumption:** Pass `ReusedSubagentId` for iterative workflows

## Parallel Auditing

For large-scale audits:
1. Split into isolated domains (Backend, Frontend, Infrastructure)
2. Use `generalist` subagents in parallel
3. Ensure task independence (no concurrent mutations on same resources)
