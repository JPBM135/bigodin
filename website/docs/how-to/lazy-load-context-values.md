---
title: 'Lazy-load context values'
sidebar_position: 6
---

**Problem.** A render only sometimes needs an expensive value: a database join, an HTTP call, a computed field. A template might not reference it at all, or might reference it several times. You want to pay for the load only when the template reads it, and only once.

**Why this works.** A `LazyValue` placed in the context is a marker. Bigodin resolves it the first time a template path or helper reads it, awaits the loader, strips the result through the same [context clone](/docs/explanation/security-model#the-context-clone) as any eager value, and (by default) memoizes it for the rest of the render. A lazy value the template never touches never loads.

This is different from an [async helper](/docs/how-to/async-helpers): a helper is keyed by name in a registry and called explicitly (`{{user 42}}`); a lazy value attaches "load this on demand" to a **position in the data**, resolved transparently by ordinary path access (`{{user.name}}`).

## Recipe: a lazy ORM row

```javascript
import Bigodin, { lazy } from '@jpbm135/bigodin';

const bigodin = new Bigodin();
const template = bigodin.compile('{{#with author}}{{name}} <{{email}}>{{/with}}');

const html = await template({
  postId: 7,
  author: lazy(() => db.user(authorId)), // runs only because {{#with author}} reads it
});
```

If the template were `Post #{{postId}}` with no reference to `author`, `db.user` would never be called.

## Recipe: load once, even when referenced twice

Caching is on by default and is keyed per render. Referencing the same value many times runs the loader once:

```handlebars
{{user.name}} signed in. Welcome back, {{user.name}}!
```

The same holds when one `LazyValue` instance is aliased at two paths:

```javascript
const me = lazy(() => db.user(id));
await template({ author: me, lastEditor: me }); // db.user runs once
```

Reusing that `me` instance in a **later** render loads again: each `run` gets a fresh cache, so memoization never leaks across renders.

## Recipe: re-read on every reference

For a value that should change between references (a clock, a counter, a fresh read), disable the cache:

```javascript
const context = {
  now: lazy(() => Date.now(), { cache: false }),
};
// each {{now}} in the template re-invokes the loader
```

## Recipe: tolerate a failed load

By default a loader that throws fails the whole render, with an error naming the path and position. To keep rendering, give the lazy an `onError` handler:

```javascript
const context = {
  // render empty if the lookup fails
  avatar: lazy(() => cdn.avatar(id), { onError: () => null }),

  // substitute a fallback object
  profile: lazy(() => db.profile(id), { onError: () => ({ name: 'Guest' }) }),

  // branch on the error, re-throwing to fail the render
  account: lazy(() => bank.account(id), {
    onError: (error) => {
      if (error.code === 'NOT_FOUND') return null;
      throw error;
    },
  }),
};
```

The handler receives the **raw** loader error and runs each time the value is referenced; the underlying load is still memoized, so a side-effecting loader fires at most once per render.

## Recipe: resolve a lazy field inside a helper

Helper parameters that are paths arrive already resolved. But if a parameter resolves to an **object that still holds lazy fields**, those nested fields are handed to the helper as fresh `LazyValue` wrappers. Force one with `this.resolveLazy`, which passes non-lazy values straight through:

```javascript
bigodin.addHelper('greeting', async function (user) {
  const profile = await this.resolveLazy(user.profile); // loads on demand
  return `Hi, ${profile?.displayName ?? user.name}`;
});

await bigodin.compile('{{greeting user}}')({
  user: { name: 'ada', profile: lazy(() => db.profile(adaId)) },
});
```

## Gotchas

- **A loader is not interrupted by `maxExecutionMillis`.** The budget is checked between statements, exactly as with async helpers; a slow loader completes and the next statement trips the wall. See [Bound execution time](/docs/how-to/bound-execution-time).
- **Don't return a `LazyValue` from a helper.** It is not auto-resolved at the render site and stringifies as `[object Object]`. Resolve it with `this.resolveLazy` first.
- **Don't return a `LazyValue` directly from a loader.** A lazy nested inside a returned object resolves on the next path hop; a loader whose top-level return is itself lazy is not unwrapped.

## Related

- [Write async helpers](/docs/how-to/async-helpers) for the registry-based alternative
- [Library API](/docs/lib#lazy-context-values) for the full `lazy` / `LazyValue` reference
- [Why interpret, not compile](/docs/explanation/security-model#the-context-clone) for how resolved values are stripped
