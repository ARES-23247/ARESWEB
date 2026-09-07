import { expect } from "vitest";
type Data = Record<string, unknown>;
type Filter = [string, string, unknown];
export class WaggleStore {
  data = new Map<string, Data>();
  failRead = "";
  failWrite = "";
  beforeTransaction: (() => void) | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  collection(path: string) {
    return new Query(this, path);
  }
  doc(path: string) {
    return {
      path,
      id: path.split("/").at(-1)!,
      get: async () => this.snapshot(path),
      collection: (name: string) => this.collection(`${path}/${name}`),
    };
  }
  snapshot(path: string) {
    if (this.failRead === path) throw new Error("Storage unavailable");
    const value = this.data.get(path);
    return {
      ref: this.doc(path),
      id: path.split("/").at(-1)!,
      exists: value !== undefined,
      data: () => structuredClone(value),
    };
  }
  runTransaction<T>(
    callback: (tx: {
      get: (ref: Query | ReturnType<WaggleStore["doc"]>) => Promise<unknown>;
      set: (ref: { path: string }, data: Data) => void;
      delete: (ref: { path: string }) => void;
    }) => Promise<T>,
  ): Promise<T> {
    const result = this.queue.then(async () => {
      this.beforeTransaction?.();
      const writes: [string, Data | null][] = [];
      const value = await callback({
        get: async (ref) => {
          expect(writes).toHaveLength(0);
          return ref instanceof Query ? ref.get() : this.snapshot(ref.path);
        },
        set: (ref, data) => {
          if (ref.path === this.failWrite)
            throw new Error("Storage unavailable");
          writes.push([ref.path, structuredClone(data)]);
        },
        delete: (ref) => {
          if (ref.path === this.failWrite)
            throw new Error("Storage unavailable");
          writes.push([ref.path, null]);
        },
      });
      for (const [path, data] of writes) {
        if (data === null) this.data.delete(path);
        else this.data.set(path, data);
      }
      return value;
    });
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  get firestore() {
    return this as unknown as FirebaseFirestore.Firestore;
  }
}
function comparable(value: unknown): string | number {
  if (value instanceof Date) return value.getTime();
  return value as string | number;
}
class Query {
  constructor(
    readonly db: WaggleStore,
    readonly path: string,
    readonly filters: Filter[] = [],
    readonly orders: [string, string][] = [],
    readonly cap = Infinity,
    readonly after: unknown[] = [],
  ) {}
  doc(id: string) {
    return this.db.doc(`${this.path}/${id}`);
  }
  where(field: string, op: string, value: unknown) {
    return new Query(
      this.db,
      this.path,
      [...this.filters, [field, op, value]],
      this.orders,
      this.cap,
      this.after,
    );
  }
  orderBy(field: unknown, direction: string) {
    return new Query(
      this.db,
      this.path,
      this.filters,
      [
        ...this.orders,
        [typeof field === "string" ? field : "__name__", direction],
      ],
      this.cap,
      this.after,
    );
  }
  limit(cap: number) {
    return new Query(
      this.db,
      this.path,
      this.filters,
      this.orders,
      cap,
      this.after,
    );
  }
  startAfter(...values: unknown[]) {
    return new Query(
      this.db,
      this.path,
      this.filters,
      this.orders,
      this.cap,
      values,
    );
  }
  async get() {
    if (this.db.failRead === this.path) throw new Error("Storage unavailable");
    expect(this.cap).toBeLessThanOrEqual(26);
    const field = (path: string, key: string): unknown =>
      key === "__name__"
        ? path.split("/").at(-1)
        : key
            .split(".")
            .reduce<unknown>(
              (value, part) => (value as Data)?.[part],
              this.db.data.get(path),
            );
    const compare = (a: unknown, b: unknown, direction = "asc") =>
      (comparable(a) < comparable(b)
        ? -1
        : comparable(a) > comparable(b)
          ? 1
          : 0) * (direction === "desc" ? -1 : 1);
    const keys = [...this.db.data.keys()]
      .filter(
        (path) =>
          path.startsWith(this.path + "/") &&
          !path.slice(this.path.length + 1).includes("/"),
      )
      .filter((path) =>
        this.filters.every(([key, op, value]) => {
          const cmp = compare(field(path, key), value);
          if (op === "==") return field(path, key) === value;
          if (op === "<=")
            return (
              cmp <= 0 &&
              field(path, key) !== undefined &&
              field(path, key) !== null
            );
          if (op === ">") return cmp > 0;
          throw new Error("Unsupported test filter");
        }),
      )
      .sort(
        (a, b) =>
          this.orders
            .map(([key, dir]) => compare(field(a, key), field(b, key), dir))
            .find((cmp) => cmp !== 0) ?? 0,
      )
      .filter(
        (path) =>
          !this.after.length ||
          (this.orders
            .map(([key, dir], i) =>
              compare(field(path, key), this.after[i], dir),
            )
            .find((cmp) => cmp !== 0) ?? 0) > 0,
      )
      .slice(0, this.cap);
    const docs = keys.map((path) => this.db.snapshot(path));
    return { docs, size: docs.length, empty: docs.length === 0 };
  }
}
