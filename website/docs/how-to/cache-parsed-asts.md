---
title: 'Cache parsed ASTs'
sidebar_position: 2
---

**Problem.** You render the same templates many times, possibly across services, and parsing them on every request is wasted work. You want to parse once and run many times.

**Why this works.** Bigodin separates `parse` (template source → AST) from `run` (AST + context → string). The AST is plain JSON. You can `JSON.stringify` it, send it over the wire, write it to disk, push it into Redis, embed it in a build artifact. Anything that can hold a JSON object can cache a Bigodin AST.

## Recipe: parse at build time, run at request time

```javascript
// build.mjs (run during deployment / startup)
import { parse } from '@jpbm135/bigodin';
import { writeFileSync } from 'node:fs';

const ast = parse('Hello, {{name}}!');
writeFileSync('greeting.ast.json', JSON.stringify(ast));
```

```javascript
// server.mjs (request handler)
import { run } from '@jpbm135/bigodin';
import { readFileSync } from 'node:fs';

const ast = JSON.parse(readFileSync('greeting.ast.json', 'utf8'));

export async function render(context) {
  return run(ast, context);
}
```

For a custom-helper instance, use `bigodin.run(ast, ...)` instead of the module-level `run`.

## Recipe: cache in Redis (or any KV store)

The AST is keyed by the source template. Cache by hash so equal templates share a slot:

```javascript
import { parse, run } from '@jpbm135/bigodin';
import { createHash } from 'node:crypto';

async function getCachedAst(redis, source) {
  const key = `bigodin:ast:${createHash('sha256').update(source).digest('hex')}`;

  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const ast = parse(source);
  await redis.set(key, JSON.stringify(ast), 'EX', 86400);
  return ast;
}

export async function render(redis, source, context) {
  const ast = await getCachedAst(redis, source);
  return run(ast, context);
}
```

## Recipe: parse in one service, run in another

The two phases can run in different processes. A "template editor" service can parse, validate, and ship ASTs to a "render" service that never sees the original source:

```
+--------------+    AST (JSON)    +--------------+
| Editor svc   | ---------------> | Render svc   |
| parse only   |                  | run only     |
+--------------+                  +--------------+
```

This is the deployment pattern Bigodin was designed for. Two consequences:

1. The render service does not need the parser, but they must be on compatible Bigodin versions (see below).
2. Whatever validation you do at parse time (helper allow-listing, depth checks) must happen before the AST is shipped; once it arrives at the render service it is a trusted artifact.

## The version contract: handle "parse it again"

Every parsed AST has a `version` field. When the AST shape changes in a new Bigodin release, the runner enforces a `[MIN_VERSION, MAX_VERSION]` window and **refuses** ASTs outside it with a "parse it again" error.

This is intentional: a silent shape mismatch is worse than a loud failure. Your cache layer must handle the rejection by re-parsing:

```javascript
import { parse, run } from '@jpbm135/bigodin';

async function renderWithFallback(redis, source, context) {
  let ast = await getCachedAst(redis, source);
  try {
    return await run(ast, context);
  } catch (err) {
    if (!err.message?.includes('parse')) throw err;
    // version mismatch — re-parse and replace the cache entry
    ast = parse(source);
    await redis.set(cacheKey(source), JSON.stringify(ast), 'EX', 86400);
    return run(ast, context);
  }
}
```

In practice, the cleanest mitigation is to invalidate the cache on deploy. Including the Bigodin version (or your app's deploy id) in the cache key means a deploy that bumps Bigodin automatically misses the old entries:

```javascript
const key = `bigodin:${BIGODIN_VERSION}:ast:${hash}`;
```

## Related

- [The AST contract](/docs/explanation/ast-and-versioning) for why the version window exists and how to interpret it
- [Library API](/docs/lib) for `parse`, `run`, and `RunOptions`
