---
name: aresweb-typescript-safety
description: Enforces strict TypeScript type safety patterns across the ARESWEB codebase. Use when editing TypeScript files, especially API routes, zod schemas, or any code involving type assertions.
---

# ARESWEB TypeScript Safety Standards

You are the TypeScript Type Safety Enforcer for Team ARES 23247. Your role is to ensure the codebase maintains strict type safety while acknowledging the practical reality of Drizzle ORM and Hono OpenAPI boundary typing limitations.

## When to Read This Skill

**READ THIS SKILL BEFORE:**
- Editing any `.ts` or `.tsx` file
- Writing or modifying API routes (`functions/api/routes/*.ts`)
- Defining or updating zod schemas (`shared/routes/*.ts`)
- Using type assertions (`as`)
- Working with generic types

## Core Principle: Type Safety with Pragmatic Boundaries

TypeScript exists to catch errors at compile time, not runtime. However, the ARESWEB codebase uses Drizzle ORM + Hono OpenAPI (`@hono/zod-openapi`) where the ORM's inferred return types frequently diverge from the Zod schemas that define OpenAPI response contracts. In these specific boundary zones, `as any` is the **accepted bridge pattern** — not a shortcut.

---

## 1. TYPE ASSERTION RULES

### 1.1 `as any` — Forbidden in General Code, PERMITTED at Boundaries

**FORBIDDEN in general business logic:**
```typescript
// ❌ NEVER in domain logic, utilities, or hooks
const data = response.data as any;
const user = result as unknown as User;
function processData(data: any): any { }
```

**PERMITTED at Drizzle ↔ OpenAPI Response Boundaries:**
```typescript
// ✅ Cast Drizzle query results at route handler return
const rows = await db.select().from(schema.posts).all();
return c.json(rows.map((r: any) => ({ ...r })) as any, 200);

// ✅ Cast complex response objects when Zod schema diverges from Drizzle types
return c.json({ post, history: rows } as any, 200);

// ✅ Cast Drizzle insert/update values when schema types are overly strict
await db.insert(schema.documentHistory).values({ roomId, content, createdBy } as any).run();
```

**RULES for boundary `as any`:**
1. ONLY at the `c.json(...)` return or `.values(...)` / `.set(...)` call site
2. NEVER propagate `any` into variables, helper functions, or shared types
3. ALWAYS add a comment if the cast is not obvious: `// Drizzle return type diverges from Zod schema`

### 1.2 `any` Type Annotations

**FORBIDDEN in general code. PERMITTED in specific infrastructure:**
```typescript
// ❌ NEVER in domain logic
function processData(data: any): any { }
const items: any[] = [];

// ✅ PERMITTED for Hono client export (OpenAPIHono ↔ hc() type incompatibility)
export const client: any = hc<AppType>("/api", { ... });

// ✅ PERMITTED for shared response utility return types
export function errorResponse<T extends Context>(...): any { ... }
export function successResponse<T extends Context, D>(...): any { ... }
```

### 1.3 `@ts-ignore` and `@ts-expect-error`

**FORBIDDEN in general code. PERMITTED when:**
1. Drizzle `.delete()` / `.update()` chains produce irresolvable type narrowing errors
2. Third-party modules lack type declarations (e.g., `@babel/standalone`)
3. A comment MUST explain WHY and reference the specific library/version

```typescript
// ✅ Acceptable @ts-ignore
// @ts-ignore - Drizzle delete type narrowing incompatible with eq() column inference
await (db as any).delete(schema.table).where(eq(schema.table.id, id)).execute();

// @ts-ignore - no type declarations for @babel/standalone
const mod = await import("@babel/standalone");
```

---

## 2. MANDATORY PATTERNS

### 2.1 Use `typeof` for Type Inference

**REQUIRED:**
```typescript
// ✅ Infer types from values
const config = {
  apiUrl: "/api",
  timeout: 5000,
} as const;

type Config = typeof config;
// { readonly apiUrl: string; readonly timeout: number; }
```

### 2.2 Use Generics Instead of `any`

**REQUIRED:**
```typescript
// ✅ Generic functions preserve type information
function getFirst<T>(items: T[]): T | undefined {
  return items[0];
}

const numbers = [1, 2, 3];
const first = getFirst(numbers);  // Type: number | undefined
```

### 2.3 Use Discriminated Unions

**REQUIRED:**
```typescript
// ✅ Type-safe state handling
type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

function handleState<T>(state: AsyncState<T>) {
  if (state.status === "success") {
    // TypeScript knows state.data exists here
    console.log(state.data);
  }
}
```

### 2.4 Use `satisfies` for Value Compatibility

**REQUIRED:**
```typescript
// ✅ Use `satisfies` to check type compatibility
const route = {
  method: "post",
  path: "/users",
} satisfies RouteConfig;

// Still allows accessing specific properties
console.log(route.method);  // "post"
```

---

## 3. ZOD-SPECIFIC PATTERNS — DRIZZLE-FIRST

### 3.0 ALWAYS Use Auto-Generated Drizzle Schemas

**GOLDEN RULE:** ALL Zod schemas for database entities MUST derive from `shared/db/schema-zod.ts` (the bridge to `src/db/schema.ts`). NEVER hand-write duplicate schemas.

```typescript
// ✅ CORRECT: Import auto-generated schema from Drizzle
import { selectPostSchema, insertPostSchema } from "@shared/db/schema-zod";
import { toCamelCaseResponse, createResponseSchema } from "@shared/db/schema-openapi";

// Derive response schema from Drizzle (single source of truth!)
export const postResponseSchema = toCamelCaseResponse(
  selectPostSchema.pick({
    slug: true,
    title: true,
    createdAt: true,
  })
);

// Use for validation
type Post = z.infer<typeof selectPostSchema>;
type CreatePost = z.infer<typeof insertPostSchema>;
```

```typescript
// ❌ WRONG: Hand-written schema duplicates Drizzle definition
export const postResponseSchema = z.object({
  slug: z.string(),
  title: z.string(),
  createdAt: z.string(),  // Duplicates Drizzle — maintenance burden!
});
```

**WHY:** When you add a column to `drizzle/schema.ts` and run `npm run db:generate`, the schemas in `shared/db/schema-zod.ts` automatically update. Routes using these schemas automatically get the new fields. Hand-written schemas create drift.

**The Auto-Generation Chain:**
```
src/db/schema.ts (YOU EDIT)
  → npm run db:generate (Migrations)
  → shared/db/schema-zod.ts (TypeScript Inference Bridge)
  → shared/routes/*.ts (IMPORT & USE)
```

**When adding a database column:**
1. Edit `src/db/schema.ts` — add the column
2. Run `npm run db:generate`
3. Run `npm run db:push` (apply to local DB)
4. The route schemas automatically include the new field via the Zod bridge!

### 3.1 Infer Types from Zod Schemas

**REQUIRED:**
```typescript
// ✅ Always infer, never duplicate types
import { z } from "zod";

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

// Infer TypeScript type from schema
type User = z.infer<typeof UserSchema>;

// ✅ Use for input/output types
type CreateUserInput = z.input<typeof UserSchema>;
type CreateUserOutput = z.output<typeof UserSchema>;
```

**FORBIDDEN:**
```typescript
// ❌ NEVER duplicate type definitions
interface User {
  id: string;
  name: string;
  email: string;
}

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

// This creates a maintenance burden and allows drift
```

### 3.2 Use `z.refine()` for Custom Validation

**REQUIRED:**
```typescript
// ✅ Custom validation within zod
const EventSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  {
    message: "End date must be after start date",
    path: ["endDate"],
  }
);
```

**FORBIDDEN:**
```typescript
// ❌ Manual validation in handlers
const handler = async (c: Context) => {
  const body = await c.req.json();
  if (new Date(body.endDate) <= new Date(body.startDate)) {
    return c.json({ error: "Invalid dates" }, 400);
  }
};
```

### 3.3 Use `z.transform()` for Data Normalization

**REQUIRED:**
```typescript
// ✅ Normalize data within the schema
const PostSchema = z.object({
  title: z.string(),
  slug: z.string().optional(),
}).transform((data) => ({
  ...data,
  slug: data.slug ?? slugify(data.title),
}));

type Post = z.output<typeof PostSchema>;
// slug is now guaranteed to be a string
```

### 3.4 Use `z.discriminatedUnion()` for Variants

**REQUIRED:**
```typescript
// ✅ Type-safe variant handling
const SearchResultSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("post"),
    id: z.string(),
    title: z.string(),
    slug: z.string(),
  }),
  z.object({
    type: z.literal("event"),
    id: z.string(),
    title: z.string(),
    date: z.string(),
  }),
]);

type SearchResult = z.infer<typeof SearchResultSchema>;

// TypeScript knows exactly which fields exist
function getTitle(result: SearchResult): string {
  if (result.type === "post") {
    return result.slug;  // Accessing post-specific field
  }
  return result.date;    // Accessing event-specific field
}
```

---

## 4. HONO-SPECIFIC PATTERNS

### 4.1 Always Use `typedHandler` with Route Types

**REQUIRED:**
```typescript
import { createRoute } from "@hono/zod-openapi";

const myRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: BodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ResponseSchema,
        },
      },
    },
    ...standardErrors,
  },
});

// ✅ typedHandler ensures request/response are properly typed
router.openapi(myRoute, typedHandler<typeof myRoute>(async (c) => {
  const body = c.req.valid("json");  // Type: z.infer<typeof BodySchema>
  return c.json({ success: true }, 200);  // Validated against ResponseSchema
}));
```

### 4.2 Throw-Only Error Policy (MANDATORY)

**FORBIDDEN — error returns:**
```typescript
// ❌ NEVER return error responses from handlers
return c.json({ error: "Not found" }, 404);
return errorResponses.notFound(c, "Post not found");
```

**REQUIRED — throw ApiError:**
```typescript
import { ApiError } from "../../shared/errors/api";

// ✅ ALL errors MUST be thrown, NEVER returned
router.openapi(myRoute, typedHandler<typeof myRoute>(async (c) => {
  const post = await db.select().from(schema.posts).where(eq(schema.posts.slug, slug)).get();
  if (!post) throw new ApiError(404, "Post not found");
  
  // Handler only returns success objects
  return c.json({ post } as any, 200);
}));
```

**WHY:** Returning error responses pollutes the handler's return type with union types (`SuccessResponse | ErrorResponse`), which causes `TS2769` overload mismatches with Hono's `c.json()`. The global error handler middleware catches thrown `ApiError` instances and formats them consistently.

### 4.3 Response Boundary Casting

**REQUIRED pattern for Drizzle → Hono responses:**
```typescript
// ✅ Cast at the c.json() boundary when Drizzle types diverge from Zod schema
return c.json(rows.map((r: any) => ({
  id: r.id,
  title: r.title,
  created_at: r.createdAt,  // camelCase → snake_case
})) as any, 200);

// ✅ For simple responses, cast the entire body
return c.json({ success: true, label: row.label } as any, 200);

// ✅ For status codes derived from logic, cast the status
return c.json(response, status as any);
```

### 4.4 Hono Client Type Strategy

**REQUIRED:**
```typescript
// ✅ The Hono client MUST be typed as `any` because OpenAPIHono extends Hono
// with metadata incompatible with hc()'s type inference
export const client: any = hc<AppType>("/api", { ... });
```

**WHY:** `hc<AppType>` infers as `unknown` because `AppType` from OpenAPIHono has structural incompatibilities with hc's expected type. Individual `src/api/*.ts` wrapper functions provide their own type safety through Zod schemas and explicit annotations.

---

## 5. REACT-SPECIFIC PATTERNS

### 5.1 Define Component Props Explicitly

**REQUIRED:**
```typescript
// ✅ Explicit props interface
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

export function Button({ children, onClick, variant = "primary", disabled }: ButtonProps) {
  // ...
}
```

**FORBIDDEN:**
```typescript
// ❌ Implicit props type
export function Button({ children, onClick, variant = "primary" }: any) {
  // ...
}
```

### 5.2 Use `React.FC` Sparingly

**PREFERRED:**
```typescript
// ✅ Function declaration with explicit props
function UserProfile({ userId }: { userId: string }) {
  // ...
}

// ✅ Arrow function with explicit props
const UserProfile = ({ userId }: { userId: string }) => {
  // ...
};
```

**AVOID:**
```typescript
// ⚠️ React.FC is generally unnecessary
const UserProfile: React.FC<{ userId: string }> = ({ userId }) => {
  // ...
};
```

### 5.3 Type Event Handlers Properly

**REQUIRED:**
```typescript
// ✅ Proper event types
function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
  setValue(e.target.value);
}

function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
  e.preventDefault();
}

function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
}
```

---

## 6. UTILITY TYPES TO USE

### 6.1 Common TypeScript Utility Types

```typescript
// Make all properties optional
type PartialUser = Partial<User>;

// Make all properties required
type RequiredUser = Required<PartialUser>;

// Make specific properties optional
type UserWithOptionalEmail = Partial<Pick<User, "email">> & Omit<User, "email">;

// Create a type with specific properties
type UserSummary = Pick<User, "id" | "name" | "email">;

// Exclude properties from a type
type CreateUserRequest = Omit<User, "id" | "createdAt">;

// Make all properties readonly
type ReadonlyUser = Readonly<User>;

// Create a union of array element types
type UserRole = User["role"];  // Extracts the role property type

// Promise resolution type
type UserData = Awaited<ReturnType<typeof fetchUser>>;
```

### 6.2 Template Literal Types

```typescript
// ✅ Type-safe event names
type EventName = `on${Capitalize<string>}`;

// Type-safe API routes
type ApiRoute = `/api/${string}`;
```

---

## 7. MIGRATION CHECKLIST

When updating existing code to follow type safety standards:

- [ ] Replace ALL `return errorResponses.*()` with `throw new ApiError(...)`
- [ ] Use `typedHandler<typeof route>` for ALL Hono route handlers
- [ ] Cast Drizzle results to `as any` at the `c.json()` boundary (NOT in business logic)
- [ ] Cast `.values()` and `.set()` to `as any` when Drizzle schema diverges
- [ ] Remove `as any` from ALL non-boundary code
- [ ] Remove `@ts-ignore` unless documenting Drizzle/third-party bugs
- [ ] Infer types from Zod schemas instead of duplicating
- [ ] Define explicit interfaces for component props
- [ ] Use discriminated unions for variant types
- [ ] Verify with `npx tsc --noEmit` — ZERO errors required

---

## 8. VSCODE SETTINGS RECOMMENDATION

Add to `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.strict": true,
  "typescript.strictNullChecks": true,
  "typescript.noImplicitAny": true,
  "typescript.noImplicitThis": true,
  "typescript.noUnusedLocals": true,
  "typescript.noUnusedParameters": true,
  "typescript.noImplicitReturns": true,
  "typescript.noFallthroughCasesInSwitch": true,
  "typescript.strictBindCallApply": true,
  "typescript.strictFunctionTypes": true,
  "typescript.strictNullChecks": true,
  "typescript.strictPropertyInitialization": true
}
```

---

## 9. TSUPPRT RULES TO ENABLE

Recommended `tsupprt` rules in `tsupprt.json`:

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-argument": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "warn",
    "@typescript-eslint/prefer-optional-chain": "warn",
    "@typescript-eslint/strict-boolean-expressions": "warn"
  }
}
```
