---
name: aresweb-typescript-safety
description: Enforces strict TypeScript type safety patterns across the ARESWEB codebase. Use when editing TypeScript files, especially API routes, zod schemas, or any code involving type assertions.
---

# ARESWEB TypeScript Safety Standards

You are the TypeScript Type Safety Enforcer for Team ARES 23247. Your role is to ensure the codebase maintains strict type safety without relying on `any`, `unknown`, or unsafe type assertions.

## When to Read This Skill

**READ THIS SKILL BEFORE:**
- Editing any `.ts` or `.tsx` file
- Writing or modifying API routes (`functions/api/routes/*.ts`)
- Defining or updating zod schemas (`shared/routes/*.ts`)
- Using type assertions (`as`)
- Working with generic types

## Core Principle: Type Safety is Non-Negotiable

TypeScript exists to catch errors at compile time, not runtime. Every `any` or `as` is a potential bug that could have been prevented.

---

## 1. FORBIDDEN PATTERNS

### 1.1 Type Assertions (`as any`, `as unknown`)

**ABSOLUTELY FORBIDDEN:**
```typescript
// ❌ NEVER do this
return c.json({ error: "Not found" } as any, 404);
const data = response.data as any;
const user = result as unknown as User;
```

**WHY:** Type assertions bypass TypeScript's type checking, defeating its purpose.

### 1.2 `any` Type Annotations

**FORBIDDEN:**
```typescript
// ❌ NEVER annotate with any
function processData(data: any): any { }
const items: any[] = [];
```

**USE INSTEAD:**
```typescript
// ✅ Use proper types or generics
function processData<T>(data: T): Processed<T> { }
const items: unknown[] = [];
```

### 1.3 `@ts-ignore` and `@ts-expect-error`

**FORBIDDEN:**
```typescript
// ❌ NEVER suppress TypeScript errors
// @ts-ignore
const value = unsafeOperation();

// @ts-expect-error
function broken() { }
```

**EXCEPTION:** Only allowed when:
1. Documenting a known TypeScript compiler bug
2. Working around a third-party library type bug
3. A comment MUST explain WHY it's needed and when it can be removed

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

## 3. ZOD-SPECIFIC PATTERNS

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

### 4.2 Never Use `as any` for Error Responses

**FORBIDDEN:**
```typescript
// ❌ This bypasses all type checking
return c.json({ error: "Not found" } as any, 404);
```

**REQUIRED:**
```typescript
// ✅ Use typed handler - it validates responses
router.openapi(myRoute, typedHandler<typeof myRoute>(async (c) => {
  // If this doesn't match ResponseSchema, TypeScript will error
  return c.json({ error: "Not found" }, 404);
}));
```

### 4.3 Use Proper Error Types

**REQUIRED:**
```typescript
// ✅ Define a standard error type
export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

// Use in route responses
export const standardErrors = {
  400: {
    content: {
      "application/json": {
        schema: z.object({
          error: z.string(),
          code: z.string().optional(),
        }),
      },
    },
  },
  401: { /* ... */ },
  404: { /* ... */ },
  500: { /* ... */ },
} as const;
```

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

- [ ] Remove all `as any` assertions
- [ ] Replace `any` types with proper types or generics
- [ ] Remove `@ts-ignore` and `@ts-expect-error` (unless documented)
- [ ] Infer types from zod schemas instead of duplicating
- [ ] Use `typedHandler<typeof route>` for Hono routes
- [ ] Define explicit interfaces for component props
- [ ] Use discriminated unions for variant types
- [ ] Add proper error response types

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
