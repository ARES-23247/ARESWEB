# Phase 41: React Hooks Dependency Audit Plan

## 1. Goal
Refactor components with suppressed `react-hooks/exhaustive-deps` warnings to use stable dependency patterns.

## 2. Target Files
- `src/components/simulation/SimulationPlayground.tsx`
- `src/components/ProfileEditor.tsx`
- `src/components/events/SeasonEditor.tsx` (disable set-state-in-effect)
- `src/components/events/TeamAvailability.tsx`
- `src/components/events/EventSelector.tsx`
- `src/components/scouting/ScoutingTool.tsx`

## 3. Actions
- Review `SimulationPlayground.tsx` suppressions. Often caused by animation frame loops inside `useEffect`. Use `useRef` to hold mutable callbacks or dependencies if needed.
- Review `ProfileEditor.tsx` for `reset()` calls inside `useEffect`.
- Review `SeasonEditor.tsx` for `setState` in `useEffect` and convert to event-driven state updates or derived state.
- Do the same for `TeamAvailability.tsx`, `EventSelector.tsx`, and `ScoutingTool.tsx`.
- Re-run `npm run lint` and verify `tsc --noEmit`.
