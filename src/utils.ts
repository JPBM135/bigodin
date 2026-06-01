export const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'hasOwnProperty']);

export function deepCloneNullPrototype(obj: object): object {
  return cloneValue(obj, new WeakMap()) as object;
}

function cloneValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Cycle guard: return the in-progress clone for any object we've already
  // started cloning, so circular references resolve to the same clone instead
  // of recursing forever and overflowing the stack.
  const existing = seen.get(value);
  if (typeof existing !== 'undefined') {
    return existing;
  }

  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(value, clone);
    for (const element of value) {
      clone.push(cloneValue(element, seen));
    }

    return clone;
  }

  // Built-in value objects keep their data outside own-enumerable keys, so the
  // generic key-copy below would erase them into an empty object (e.g. a Date
  // becomes `{}` with no getTime/valueOf/toString). Clone them by value. Their
  // methods live on the prototype, so `lookupOwnValue` still hides them from
  // templates; only helpers, which receive real values, can use them. Each is
  // registered in `seen` before returning so that, like every other branch, a
  // single instance referenced twice resolves to one shared clone.
  if (value instanceof Date) {
    const clone = new Date(value.getTime());
    seen.set(value, clone);
    return clone;
  }

  if (value instanceof RegExp) {
    const clone = new RegExp(value.source, value.flags);
    seen.set(value, clone);
    return clone;
  }

  // URL is a platform global, not part of the ES library this package targets,
  // so feature-detect it through globalThis instead of assuming it exists.
  const globalUrl = (globalThis as { URL?: new (href: string) => object }).URL;
  if (globalUrl && value instanceof globalUrl) {
    const clone = new globalUrl((value as { href: string }).href);
    seen.set(value, clone);
    return clone;
  }

  // ArrayBuffer-backed binary views. Without this, Object.keys() turns a typed
  // array into a `{0: …, 1: …}` index object that no longer behaves like one.
  if (value instanceof DataView) {
    const clone = new DataView(
      value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
    );
    seen.set(value, clone);
    return clone;
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
    seen.set(value, clone);
    return clone;
  }

  if (value instanceof ArrayBuffer) {
    const clone = value.slice(0);
    seen.set(value, clone);
    return clone;
  }

  if (value instanceof Map) {
    const clone = new Map<unknown, unknown>();
    seen.set(value, clone);
    for (const [key, val] of value) {
      clone.set(cloneValue(key, seen), cloneValue(val, seen));
    }

    return clone;
  }

  if (value instanceof Set) {
    const clone = new Set<unknown>();
    seen.set(value, clone);
    for (const element of value) {
      clone.add(cloneValue(element, seen));
    }

    return clone;
  }

  const clone: Record<string, unknown> = Object.create(null);
  seen.set(value, clone);
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
        get: () => (memo ??= { value: cloneValue(getter(), seen) }).value,
      });
      continue;
    }

    clone[key] = cloneValue(source[key], seen);
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
