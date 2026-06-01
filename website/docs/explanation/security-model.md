---
title: 'Why interpret, not compile'
sidebar_position: 1
---

The most repeated description of Bigodin is "safe to run on user input." This page explains what that means in practice, what threats Bigodin defends against, and what it deliberately leaves to you.

The core decision is in the title: Bigodin **interprets** templates against a JSON AST. It does not compile templates to JavaScript. This single choice is the source of most of the safety properties.

## What "interpret, not compile" actually means

Most templating libraries are compilers. They take a template string, emit JavaScript source, and call `new Function(...)` (or `eval`) to produce a callable. Compiled templates are fast, but they have a sharp edge: every step from "string" to "running code" must be perfectly tight, because the output is real JavaScript with full access to the host's globals.

Bigodin never produces JavaScript from a template. The pipeline is:

```
template string -> parser combinators -> JSON AST -> interpreter walks AST -> output string
```

Every node in the AST is a plain object describing a statement: text, mustache, block, comment, expression, literal, variable, assignment. The interpreter (`runStatement` in `src/runner/index.ts`) is a `switch` over those node types, and every branch only produces strings or invokes registered helpers. There is no path from "the template said something" to "JavaScript was evaluated."

The library has zero `eval`, zero `new Function`, zero `vm` module use. You can grep for them.

## What this defends against

**Template injection.** A user submitting `{{constructor.constructor("...")}}` cannot reach `Function`, because the AST has no notion of method calls or property access on JavaScript values. Path lookups walk a JSON-like structure, full stop.

**Helper-name prototype pollution.** Helper resolution rejects names matching `__proto__`, `constructor`, `prototype`, and the rest of `UNSAFE_KEYS`. A template cannot register or invoke a helper under those names. The same check is applied at `addHelper` time, so a host application also cannot register a helper that conflicts with a forbidden name.

**Sandbox escape via context.** A template can read context values; it cannot invoke them. A function placed in context falls through (Mustache-style lambdas are not supported on purpose). The only callable surface is the helper registry you control.

**Runaway helpers and templates.** `RunOptions.maxExecutionMillis` is checked at the top of every statement. `this.halt()` and `{{return}}` give cooperative early exit. Together they bound how much work a hostile template can do; see [Bound execution time](/docs/how-to/bound-execution-time).

**Persisted-AST drift.** If the AST shape changes between releases, old persisted ASTs are rejected at run time rather than silently misinterpreted. See [The AST contract](/docs/explanation/ast-and-versioning).

## What this does not defend against

The boundary is "the template cannot do anything you did not give it." That has implications:

- **Helpers run with full Node privilege.** A helper you write that calls `fs.readFileSync('/etc/passwd')` will read /etc/passwd. The sandbox is the registry of helpers you registered, not the helpers themselves.
- **HTML injection is your problem.** Bigodin emits raw output by default. If you render HTML, you escape; see [Render HTML safely](/docs/how-to/render-html-safely).
- **Resource exhaustion via output size.** There is no cap on the size of the rendered string. A `{{#each items}}` over a million items produces a million-line string.
- **CPU-bound helpers.** `maxExecutionMillis` is wall-clock. A synchronous helper that pegs the loop will starve it for the duration; the budget catches the _next_ statement, not this one.

## The data channel

Helpers receive an `Execution` instance as `this`. One field on that object, `data`, is a side channel: helpers may read and write it, templates may not. This is the supported way for a helper to surface structured information back to the host (page titles, audit log entries, accumulated warnings) without leaking it into the rendered output.

The asymmetry matters. A template cannot reach into `data`, even by walking parents or roots. The path resolver does not know `data` exists; it lives on the helper-facing `Execution`, not on the context stack.

## The context clone

Before a run starts, Bigodin deep-clones the context you pass to `run` (`deepCloneNullPrototype` in `src/utils.ts`). The render walks the clone, never your original object. The clone does two jobs at once.

**It strips prototypes.** Every plain object in the context is rebuilt with a `null` prototype, and path lookups go through `lookupOwnValue`, which returns a value only when the key is an **own, enumerable, non-function** property whose name is not in `UNSAFE_KEYS` (`__proto__`, `constructor`, `prototype`, `hasOwnProperty`). The combined effect: a template cannot reach a prototype method, a constructor, or any inherited property. There is no `{{x.constructor.constructor}}` pivot, because `constructor` is filtered and the clone has no prototype chain to walk anyway.

**It isolates your input.** Because the run mutates the clone, a helper that writes to its context (`this.contexts[0].foo = …`) changes the clone, not the object you handed in. Your input is never modified by a render.

### What templates can read

Only own, enumerable, non-function data. That has consequences worth knowing:

- **Non-enumerable own properties are invisible.** An `Error`'s `message` and `stack` are non-enumerable, so `{{err.stack}}` is empty, and file paths and traces are not leaked into output. Anything you define with `Object.defineProperty(obj, k, { enumerable: false })` is dropped from the clone.
- **Functions are dropped at read time.** A function in context is never invoked and never rendered (this is also why Mustache lambdas are unsupported).
- **Methods stay on the prototype, so they stay hidden.** This is what makes the value-type preservation below safe.

### Value-typed objects are preserved

A naive null-prototype copy would erase any object that stores its data outside enumerable string keys: a `Date` would become `{}`, a `Uint8Array` would become `{0: …, 1: …}`. Bigodin special-cases these and clones them **by value**, so helpers receive a real, working instance:

| Context value | Clone receives | Template sees |
| --- | --- | --- |
| `Date` | a copied `Date` | `[object Date]` (methods are prototype-resident, so hidden) |
| `RegExp` | a copied `RegExp` | `[object RegExp]` |
| `URL` | a copied `URL` | `[object URL]` |
| `Map` / `Set` | a deep-cloned `Map` / `Set` | nothing (`.size`, `.get`, etc. are prototype members) |
| `TypedArray` (`Uint8Array`, …) | a copy of the same subclass | per-index bytes (own props), nothing else |
| `DataView` / `ArrayBuffer` | a byte-for-byte copy | nothing |
| Node `Buffer` | a `Uint8Array` copy (see below) | per-index bytes |

The guarantee is uniform: the **value** survives for your helpers, but the **methods** do not become reachable from a template, because they live on the prototype and `lookupOwnValue` only ever returns own properties.

`Buffer` is the one downgrade. Bigodin targets the ES library only and references no Node globals, so a `Buffer` is copied into a plain `Uint8Array`: the bytes survive, but the result is not a `Buffer`. A helper that needs `Buffer`-specific methods should `Buffer.from(value)` it back.

### Circular references and getters

- **Circular references are safe.** The clone tracks objects it has already started copying, so `obj.self = obj` resolves to the same clone (`clone.self === clone`) instead of overflowing the stack.
- **Getters are evaluated lazily.** An enumerable getter on a context object is not invoked at clone time; it runs only if a template actually reads that key, and its result is stripped like any other value. A getter the template never references never fires, so there are no surprise side effects, and a throwing getter does not break a render that does not touch it.

## Why no compilation, even as an opt-in?

The recurring proposal: "could you optionally compile for speed, with a flag?" The answer is no. Two reasons.

1. **The security argument is unconditional or it is nothing.** A flag-controlled compile path means every audit must check whether the flag was set, every dependency that calls into Bigodin must opt out, and the "safe by default" framing becomes "safe if configured correctly." That is the framing every other "safe-ish" library uses, and it is the framing that fails in production.
2. **The performance gap is small for the workload Bigodin targets.** Bigodin is meant for templates submitted by users, rendered with helpers that are typically I/O-bound (HTTP, database). The interpreter overhead is dwarfed by the helper work. If you are CPU-bound on template rendering, you are probably not in Bigodin's target audience.

## What you are responsible for

Bigodin gives you a sandbox. You decide what is in it.

- **Helper allow-listing.** If you let users name the helpers they call, allow-list the names. Bigodin will happily call any helper you registered.
- **Output escaping.** For HTML output, escape every untrusted value with a helper.
- **Execution budgets.** For untrusted templates, set `maxExecutionMillis`. Pick a budget appropriate to your render path; a few milliseconds for a hot path, a few hundred for a batch job.
- **AST validation if you accept ASTs over the wire.** A persisted AST is a trusted artifact in Bigodin's model. If you accept ASTs from untrusted sources (rather than parsing source you received), validate the shape before running.

## Related

- [The AST contract](/docs/explanation/ast-and-versioning)
- [Bound execution time](/docs/how-to/bound-execution-time)
- [Render HTML safely](/docs/how-to/render-html-safely)
