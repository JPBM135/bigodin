---
title: 'The AST contract'
sidebar_position: 2
---

A Bigodin template, once parsed, is a plain JSON value. Not a closure, not an opaque handle, not an object with hidden methods. You can `JSON.stringify` it, write it to disk, post it to a service, store it in a column, embed it in a build artifact. This is a deliberate part of the design and the page below explains the contract you can rely on, the version window that protects it, and the deployment patterns it enables.

## Why a JSON AST

Two reasons.

**Persistence and portability.** A render in a hot request path should not pay the cost of parsing. Parse once at build time or first use, cache the AST, run many times. Because the AST is JSON, every cache layer you already use (Redis, S3, a database column, a CDN edge cache) works without adapters.

**Process separation.** The parser and the runner can live in different services. An "editor" service can accept template source, parse it, run validations (helper allow-listing, depth checks), and ship the AST to a "render" service that never sees the original source. The render service is smaller, cannot be tricked into parsing hostile syntax, and only ever sees a structurally valid artifact.

```
+------------------+    AST (JSON)    +------------------+
| Editor service   | ---------------> | Render service   |
| (parse + check)  |                  | (run only)       |
+------------------+                  +------------------+
```

## What the AST looks like

```javascript
import { parse } from '@jpbm135/bigodin';

const ast = parse('Hello, {{name}}!');
// {
//   type: 'TEMPLATE',
//   version: 3,
//   statements: [
//     { type: 'TEXT', value: 'Hello, ' },
//     { type: 'MUSTACHE', expression: { type: 'PATH', segments: ['name'] } },
//     { type: 'TEXT', value: '!' },
//   ],
// }
```

The exact shape is defined in `src/parser/statements.ts`. Statement kinds: `TEXT`, `COMMENT`, `MUSTACHE`, `EXPRESSION`, `BLOCK`, `LITERAL`, `VARIABLE`, `ASSIGNMENT`, `TEMPLATE`. The shape is implementation-coupled, not part of the public API; you should not construct ASTs by hand or pattern-match on internal fields. What **is** part of the public API is the round-trip:

```javascript
JSON.parse(JSON.stringify(parse(source)));
```

…produces an AST that `run` will accept, for the lifetime of the version window described below.

## The version window

Every parsed AST carries a `version: number` field at the root. The runner enforces a window:

```typescript
// src/runner/index.ts
const MIN_VERSION = 1;
const MAX_VERSION = 3;
```

When `run` receives an AST whose version is outside that window, it throws with a message that asks you to parse the template source again. It does **not** attempt to interpret the older or newer shape.

This is a deliberate choice. A silent shape mismatch between a persisted AST and a newer runner would produce subtly wrong output or hard-to-debug exceptions deep in the interpreter. A loud rejection at the boundary is better:

- **Old AST, new runner.** The runner refuses; your cache layer re-parses. See [Cache parsed ASTs](/docs/how-to/cache-parsed-asts) for the recommended fallback.
- **New AST, old runner.** The runner refuses; you upgrade.

The window widens carefully. A new statement type or a new field on an existing statement bumps `VERSION` and widens `MAX_VERSION`. ASTs from the previous range remain valid; the runner can still interpret them.

## What this means for your storage layer

If you cache ASTs, the cache key should include the Bigodin version (or your app's deploy id). On a Bigodin upgrade that bumps `VERSION`, old cache entries are stale by definition; making the version part of the key drops them automatically:

```javascript
const key = `bigodin:${BIGODIN_VERSION}:ast:${sha256(source)}`;
```

If your cache key cannot include a version (e.g. content-addressed storage), implement a re-parse fallback in your render path. The pattern is in [Cache parsed ASTs](/docs/how-to/cache-parsed-asts).

## What this means for your trust model

The version check is for shape compatibility, not for security. An AST coming back from your own cache is trusted; an AST coming from an untrusted third party is not. The runner does not validate that an AST was produced by the parser; a sufficiently deranged JSON object that happens to type-check could in principle reach helper invocation paths. The library does not anticipate that as a threat because, in the intended deployment, ASTs are produced by code you control.

If you accept ASTs over the wire from a system you do not fully trust, you should either: parse from the original source on receipt, or run your own structural validation before passing the AST to `run`. The library does not ship that validator; it would amount to "re-parse to a known good shape," which is what the parser does.

## Why not just version the library?

The library is versioned. The AST version is in addition. The reason: a Bigodin minor version that does not change the AST shape can keep `VERSION` constant, and old ASTs stay valid across every release with the same `VERSION` number. Conversely, a bug fix that _does_ require a shape change can bump `VERSION` even on a minor release. The AST window is a more precise contract than "library version equality."

In practice the library version and the AST version move together for major releases, and the AST version stays put for most minor and patch releases.

## Related

- [Cache parsed ASTs](/docs/how-to/cache-parsed-asts) for the operational pattern
- [Library API](/docs/lib) for `parse` / `run` signatures
- [Why interpret, not compile](/docs/explanation/security-model) for the broader design rationale
