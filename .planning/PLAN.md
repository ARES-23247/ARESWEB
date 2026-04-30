# Phase 58: Multi-File Sandbox & Templates Plan

## Goal
Implement a multi-file tree layout allowing users to separate components in the Simulation Playground, and provide starting templates.

## Steps
1. **State Refactoring**:
   - Change `code` state from `string` to `files` state: `Record<string, string>`.
   - Maintain `activeFile` state (e.g., `'SimComponent.jsx'`).
   - For backwards compatibility and D1 schema stability, `handleSave` will `JSON.stringify(files)` into the existing `code` column. Loading will try `JSON.parse` or fallback to treating it as single-file `SimComponent.jsx`.

2. **Compiler & Bundler (Mini CommonJS)**:
   - In `compileCode`, iterate over all `files`. Use Babel with `presets: ["react", "env"]` to transform ESM `import`/`export` to CommonJS `require`/`exports`.
   - Pass an object mapping `{ filename: compiledSource }` to `SimPreviewFrame`.
   - In `SimPreviewFrame` iframe, implement a `require(name)` polyfill that resolves `./File`, executes the wrapped function, and caches `module.exports`.
   - Finally, evaluate `SimComponent.jsx` and extract the component.

3. **UI Updates**:
   - Add a file explorer sidebar (e.g., 15% width) on the left of the editor pane to list `Object.keys(files)`.
   - Support adding files (`+ New File`), renaming, and deleting files.
   - Update editor to show the content of `activeFile`.

4. **Templates**:
   - Add a "Templates" dropdown next to "Open" that populates `files` with predefined sets (Default, Swerve Drive, Elevator).

## Automated Execution
Executing immediately.
