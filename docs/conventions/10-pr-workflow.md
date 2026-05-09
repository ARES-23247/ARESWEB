# PR Workflow

> GitHub PR creation workflow via gh CLI.

## Steps

1. **Branch:** `git checkout -b feature/<name>` (if on master)
2. **Commit:** `git commit -m "[Type]: Description"`
3. **Push:** `git push -u origin HEAD`
4. **Create PR:** `gh pr create --title "[Type] Title" --body "Summary"`

## Rules

- NEVER force push without permission
- PR title format: `[Feature/Fix] Title`
- Verify gh CLI is authenticated
