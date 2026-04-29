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
