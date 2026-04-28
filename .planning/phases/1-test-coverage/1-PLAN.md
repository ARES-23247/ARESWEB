---
wave: 1
depends_on: []
files_modified: ["functions/api/routes/posts.ts", "functions/api/routes/posts.test.ts"]
autonomous: true
---

# Phase 1: 100% Backend Test Coverage

## 1. Refactor notifyByRole Promise Chain

<read_first>
- `functions/api/routes/posts.ts`
</read_first>

<action>
Modify `functions/api/routes/posts.ts` around line 346 to resolve the uncovered V8 callback. 

Currently, the code is:
```typescript
      if (status === "pending") {
        c.executionCtx.waitUntil(
          notifyByRole(c, ["admin", "coach", "mentor"], {
            title: "📝 Pending Blog Post",
            message: `"${body.title}" submitted by ${email} needs review.`,
            link: "/dashboard/manage_blog",
            external: true,
            priority: "medium"
          }).catch((e) => console.error("[Posts] notifyByRole error:", e))
        );
      }
```

Change it to define the catch handler as a named function or await the failure so that V8 correctly records the line execution. However, `notifyByRole` is an async function and `waitUntil` takes a Promise. A better approach for coverage is to extract the promise and handle the error linearly:

```typescript
      if (status === "pending") {
        const notifyPromise = notifyByRole(c, ["admin", "coach", "mentor"], {
          title: "📝 Pending Blog Post",
          message: `"${body.title}" submitted by ${email} needs review.`,
          link: "/dashboard/manage_blog",
          external: true,
          priority: "medium"
        });
        
        c.executionCtx.waitUntil(
          notifyPromise.catch(function handleNotifyError(e) {
            console.error("[Posts] notifyByRole error:", e);
          })
        );
      }
```
Or simply use `await new Promise` inside the test to wait until the exact microtask has cleared, or just let Vitest cover the inline function properly by throwing synchronously if needed. Let's rewrite it exactly as shown above with `function handleNotifyError(e)`.
</action>

<acceptance_criteria>
- `functions/api/routes/posts.ts` contains `function handleNotifyError(e)`
- `npm run test:coverage` shows `posts.ts` at 100% for lines, branches, and functions.
</acceptance_criteria>

## 2. Verify Coverage Completion

<read_first>
- `functions/api/routes/posts.test.ts`
</read_first>

<action>
Run the coverage tools to confirm that the `posts.ts` coverage is exactly 100% and that the overall backend coverage meets the CI thresholds.
</action>

<acceptance_criteria>
- Terminal output of `npm run test:coverage` completes without the "does not meet global threshold" error (assuming the gap was just line 346).
</acceptance_criteria>

---

## Verification Criteria
- [ ] `npm run test:coverage` successfully passes all thresholds.

## Must Haves
- The backend API must hit the 100% function coverage threshold before this phase can be completed.
