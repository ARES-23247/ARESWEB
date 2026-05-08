#!/bin/bash

# Bulk fix 'as any' patterns in route files
# This script performs multiple sed replacements to migrate to new error response patterns

cd "$(dirname "$0")/.." || exit 1

# Files to process
ROUTE_FILES=$(find functions/api/routes -name "*.ts" ! -name "*.test.ts")

# Pattern replacements
# 1. Replace (async (c: any) => with typedHandler<typeof routeName>(async (c) =>
# We need to be careful about route names, so let's do a simpler pattern first

echo "Migrating route files to new error response patterns..."

for file in $ROUTE_FILES; do
  echo "Processing: $file"

  # Add errorResponses import if not present
  if ! grep -q "errorResponses" "$file"; then
    # Find the line with import from middleware and add errorResponses import after it
    sed -i '/import.*from.*middleware/a import { errorResponses } from "../../../shared/errors/api";' "$file"
  fi

  # Replace common error response patterns
  sed -i 's/return c\.json({ error: "Not found" } as any, 404 as any)/return errorResponses.notFound(c)/g' "$file"
  sed -i 's/return c\.json({ error: ".* not found" } as any, 404 as any)/return errorResponses.notFound(c, "\1")/g' "$file"
  sed -i 's/return c\.json({ error: ".* not found" } as any, 404)/return errorResponses.notFound(c)/g' "$file"
  sed -i 's/return c\.json({ error: "Unauthorized" } as any, 401 as any)/return errorResponses.unauthorized(c)/g' "$file"
  sed -i 's/return c\.json({ error: ".*unauthorized.*" } as any, 401)/return errorResponses.unauthorized(c, "\1")/g' "$file"
  sed -i 's/return c\.json({ error: ".*forbidden.*" } as any, 403)/return errorResponses.forbidden(c, "\1")/g' "$file"
  sed -i 's/return c\.json({ error: "Too many.*" } as any, 429)/return errorResponses.tooManyRequests(c)/g' "$file"
  sed -i 's/return c\.json({ error: ".*" } as any, 500 as any)/return errorResponses.internalError(c, "\1")/g' "$file"
  sed -i 's/return c\.json({ error: ".*" } as any, 500)/return errorResponses.internalError(c)/g' "$file"

  # Replace `200 as const` with `200`
  sed -i 's/, 200 as const/, 200/g' "$file"
  sed -i 's/, 404 as const/, 404/g' "$file"
  sed -i 's/, 401 as const/, 401/g' "$file"
  sed -i 's/, 403 as const/, 403/g' "$file"
  sed -i 's/, 500 as const/, 500/g' "$file"
  sed -i 's/, 429 as const/, 429/g' "$file"
  sed -i 's/, 400 as const/, 400/g' "$file"

  # Remove trailing `) as any` from route definitions
  sed -i 's/}) as any);/});/g' "$file"
  sed -i 's/) as any,)/)/g' "$file"

  # Replace `(async (c: any) =>` with `(async (c) =>` as a temp step
  sed -i 's/(async (c: any) =>/(async (c) =>/g' "$file"

  # Remove eslint-disable for @typescript-eslint/no-explicit-any if present
  sed -i '/\/\* eslint-disable @typescript-eslint\/no-explicit-any \*\//d' "$file"
done

echo "Done! Please review changes and run TypeScript to check for errors."
echo "Remaining $(grep -r "as any" functions/api/routes --include="*.ts" | wc -l) occurrences of 'as any'"
