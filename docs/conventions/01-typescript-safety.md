# TypeScript Safety Standards

> Read this before editing `.ts` or `.tsx` files, API routes, or zod schemas.

## Core Principle

TypeScript catches errors at compile time. At **Drizzle ↔ OpenAPI boundaries**, `as any` is the accepted bridge pattern — not a shortcut.

---

## Type Assertion Rules

### `as any` — Boundary Only

**PERMITTED at Drizzle/OpenAPI boundaries:**
```typescript
// At c.json() return when Drizzle types diverge from Zod
return c.json(rows.map((r: any) => ({ id: r.id })) as any, 200);

// At .values()/.set() when Drizzle schema is overly strict
await db.insert(schema.table).values(data as any).run();

// For Hono client (OpenAPIHono incompatibility)
export const client: any = hc<AppType>("/api");
```

**FORBIDDEN elsewhere:**
```typescript
const data = response.data as any;  // ❌
function process(data: any): any {} // ❌
```

### `@ts-ignore` — Specific Cases Only

Permitted for: Drizzle delete/update type narrowing, third-party modules without types. **ALWAYS comment why.**

```typescript
// @ts-ignore - Drizzle delete incompatible with eq() inference
await (db as any).delete(schema.table).where(eq(schema.table.id, id)).execute();
```

---

## Required Patterns

### Infer Types from Values
```typescript
const config = { apiUrl: "/api", timeout: 5000 } as const;
type Config = typeof config;
```

### Use Generics, Not `any`
```typescript
function getFirst<T>(items: T[]): T | undefined { return items[0]; }
```

### Discriminated Unions
```typescript
type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

if (state.status === "success") {
  console.log(state.data); // TS knows this exists
}
```

### Use `satisfies`
```typescript
const route = { method: "post", path: "/users" } satisfies RouteConfig;
```

---

## Zod Patterns

### Always Infer Types
```typescript
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

type User = z.infer<typeof UserSchema>;         // ✅
type CreateUserInput = z.input<typeof UserSchema>;  // ✅
```

**❌ NEVER duplicate interface + schema**

### Custom Validation with `.refine()`
```typescript
const EventSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  { message: "End date must be after start date", path: ["endDate"] }
);
```

### Data Normalization with `.transform()`
```typescript
const PostSchema = z.object({
  title: z.string(),
  slug: z.string().optional(),
}).transform((data) => ({ ...data, slug: data.slug ?? slugify(data.title) }));
```

### Variants with `.discriminatedUnion()`
```typescript
const SearchResultSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("post"), id: z.string(), slug: z.string() }),
  z.object({ type: z.literal("event"), id: z.string(), date: z.string() }),
]);
```

---

## React Patterns

### Explicit Props
```typescript
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}
```

### Proper Event Types
```typescript
function handleChange(e: React.ChangeEvent<HTMLInputElement>) {}
function handleClick(e: React.MouseEvent<HTMLButtonElement>) {}
function handleSubmit(e: React.FormEvent<HTMLFormElement>) {}
```

---

## Hono-Specific

### Always Use `typedHandler`
```typescript
router.openapi(myRoute, typedHandler<typeof myRoute>(async (c) => {
  const body = c.req.valid("json");
  return c.json({ success: true }, 200);
}));
```

### Throw-Only Error Policy
```typescript
// ❌ NEVER return errors
if (!result) return c.json({ error: "Not found" }, 404);

// ✅ ALWAYS throw errors
if (!result) throw new ApiError(404, "Not found");
```

---

## Utility Types
```typescript
type PartialUser = Partial<User>;              // Optional properties
type UserSummary = Pick<User, "id" | "name">;  // Specific properties
type CreateUserReq = Omit<User, "id">;         // Exclude properties
type UserRole = User["role"];                  // Extract property type
type UserData = Awaited<ReturnType<typeof fetchUser>>; // Promise unwrap
```
