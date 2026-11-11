export const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'hasOwnProperty']);

// Maximum nesting depth of a context object. The clone is recursive, so an
// absurdly deep context would otherwise surface as an opaque stack overflow.
export const MAX_CONTEXT_DEPTH = 1_000;

export function deepCloneNullPrototype(obj: object): object {
  // A function as the root context is treated as an empty context, like every
  // other function value in the clone.
  return (cloneValue(obj, new WeakMap(), 0) ?? Object.create(null)) as object;
}

// Record an `original -> clone` mapping for the cycle guard, and also
// `clone -> clone`, which makes cloneValue idempotent. Getters are bound to the
// clone, so one may legally return `this` or another already-cloned object;
// without the self-mapping, cloneValue would deep-clone an already-safe
// subgraph again (wasteful) and break reference identity within the clone.
function track<T extends object>(seen: WeakMap<object, unknown>, original: object, clone: T): T {
  seen.set(original, clone);
  seen.set(clone, clone);
  return clone;
}

function cloneValue(value: unknown, seen: WeakMap<object, unknown>, depth: number): unknown {
  // Functions never enter the clone. Templates must not be able to read them
  // (rendering one leaks its source code) and the runner must not call them: a
  // function-valued `then` would otherwise turn its owner into a thenable that
  // the async runner invokes, or waits on forever. Helpers are the only
  // callable surface.
  if (typeof value === 'function') {
    return undefined;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Cycle guard: return the existing clone for any object we have already
  // started cloning, or any clone we produced. This resolves circular
  // references and getters that return already-cloned objects to the same
  // clone instead of recursing forever or re-copying a safe subgraph.
  const existing = seen.get(value);
  if (typeof existing !== 'undefined') {
    return existing;
  }

  if (depth > MAX_CONTEXT_DEPTH) {
    throw new Error(`Context is nested too deeply, the limit is ${MAX_CONTEXT_DEPTH} levels`);
  }

  const next = depth + 1;

  if (Array.isArray(value)) {
    const clone = track(seen, value, [] as unknown[]);
    for (const element of value) {
      clone.push(cloneValue(element, seen, next));
    }

    return clone;
  }

  // Built-in value objects keep their data outside own-enumerable keys, so the
  // generic key-copy below would erase them into an empty object (e.g. a Date
  // becomes `{}` with no getTime/valueOf/toString). Clone them by value. Their
  // methods live on the prototype, so `lookupOwnValue` still hides them from
  // templates; only helpers, which receive real values, can use them. Each is
  // tracked so that, like every other branch, a single instance referenced
  // twice resolves to one shared clone.
  if (value instanceof Date) {
    return track(seen, value, new Date(value.getTime()));
  }

  if (value instanceof RegExp) {
    return track(seen, value, new RegExp(value.source, value.flags));
  }

  // URL is a platform global, not part of the ES library this package targets,
  // so feature-detect it through globalThis instead of assuming it exists.
  const globalUrl = (globalThis as { URL?: new (href: string) => object }).URL;
  if (globalUrl && value instanceof globalUrl) {
    return track(seen, value, new globalUrl((value as { href: string }).href));
  }

  // ArrayBuffer-backed binary views. Without this, Object.keys() turns a typed
  // array into a `{0: …, 1: …}` index object that no longer behaves like one.
  if (value instanceof DataView) {
    return track(
      seen,
      value,
      new DataView(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)),
    );
  }

  if (ArrayBuffer.isView(value)) {
    const TypedArrayCtor = Object.getPrototypeOf(value).constructor;
    // Node Buffer subclasses Uint8Array but only exposes a deprecated
    // constructor, and this package stays environment-agnostic (no Node
    // globals), so copy it into a plain Uint8Array - the bytes survive.
    const clone =
      TypedArrayCtor.name === 'Buffer'
        ? Uint8Array.from(value as Uint8Array)
        : new TypedArrayCtor(value);
    return track(seen, value, clone);
  }

  if (value instanceof ArrayBuffer) {
    return track(seen, value, value.slice(0));
  }

  if (value instanceof Map) {
    const clone = track(seen, value, new Map<unknown, unknown>());
    for (const [key, val] of value) {
      clone.set(cloneValue(key, seen, next), cloneValue(val, seen, next));
    }

    return clone;
  }

  if (value instanceof Set) {
    const clone = track(seen, value, new Set<unknown>());
    for (const element of value) {
      clone.add(cloneValue(element, seen, next));
    }

    return clone;
  }

  const clone = track(seen, value, Object.create(null) as Record<string, unknown>);
  const source = value as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (UNSAFE_KEYS.has(key)) {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (descriptor && typeof descriptor.get === 'function') {
      // Defer getter invocation: only run it (and strip its result) when the
      // template actually reads the key. This avoids firing side effects - or
      // throwing - for fields that are never referenced. Bind it to the clone,
      // not the original, so a getter that reads or writes `this` cannot touch
      // the caller's input; and memoize, so repeated references in one render
      // run it at most once instead of re-triggering its side effects.
      const getter = descriptor.get.bind(clone);
      let memo: { value: unknown } | undefined;
      Object.defineProperty(clone, key, {
        enumerable: true,
        configurable: true,
        get: () => (memo ??= { value: cloneValue(getter(), seen, next) }).value,
      });
      continue;
    }

    const property = source[key];
    if (typeof property === 'function') {
      continue;
    }

    clone[key] = cloneValue(property, seen, next);
  }

  return clone;
}

export function ensure(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function hasOwnKey(obj: object, key: string): boolean {
  return Object.hasOwn(obj, key);
}

export function isLookupObject(value: any): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function lookupOwnValue(obj: any, key: string): any {
  if (!isLookupObject(obj) || UNSAFE_KEYS.has(key) || !hasOwnKey(obj, key)) {
    return undefined;
  }

  const value = obj[key];
  if (typeof value === 'function') {
    return undefined;
  }

  return value;
}
