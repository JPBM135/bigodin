---
title: "Introduction"
slug: "/"
sidebar_position: 1
# Auto-generated from README.md; edit the source file in the repo root.
---
Secure Handlebars/Mustache templating for user-provided templates, with async helpers and human-friendly parse errors. Templates are parsed into a JSON AST and **interpreted** at runtime — never compiled to JavaScript — so it is safe to evaluate templates submitted by end users.

Bigodin is a fork of [Bigodon](https://github.com/gabriel-pinheiro/bigodon) that drops unnecessary features and grows the supported subset of the Mustache spec, aiming to be a drop-in replacement for Mustache in user-provided template scenarios.

- 📚 [Official Documentation](https://jpbm135.github.io/bigodin)
- 🧪 Mustache spec coverage: 103 / 110 attempted tests pass (see [compatibility table](#mustache-spec-compatibility))

## Installation

```shell
yarn add @jpbm135/bigodin
# or
npm install @jpbm135/bigodin
```

Types are bundled. Node ≥ 18 required.

## Quick start

```javascript
const { compile } = require('@jpbm135/bigodin');

async function main() {
    const template = compile('Hello, {{name}}!');
    const result = await template({ name: 'George' });
    console.log(result); // Hello, George!
}

main().catch(console.error);
```

Split parsing from execution (e.g. cache the AST in Redis, parse in one service and run in another):

```javascript
const { parse, run } = require('@jpbm135/bigodin');

const ast = parse('Hello, {{name}}!'); // plain JSON — safe to persist

// later, possibly in another process:
const result = await run(ast, { name: 'George' });
```

## Features

Handlebars-style template syntax:

- Dot-path access inside mustaches (`{{foo.bar}}`)
- Literal arguments (`{{helper 5 "hi" true}}`)
- Comments (`{{! ... }}`)
- Nested expressions (`{{outer (inner data.first data.second)}}`)
- Blocks and inverted blocks (`{{#list}}…{{/list}}`, `{{^list}}…{{/list}}`)
- `{{else}}` and chained `{{else if}}`
- Context navigation with `$parent`, `$root`, `$this`
- Variable assignment (`{{= $foo "bar"}}`) within a template

What sets Bigodin apart:

- **Async helpers** — `await` requests, database calls, file IO, etc. directly from a helper.
- **Safe by construction** — no codegen, no `eval`, no `Function` constructor; templates are walked over a JSON AST.
- **Execution limits** — `maxExecutionMillis` and `halt()` let you bound runtime on hostile input.
- **Better error messages** — parser combinators surface line/column and what was expected.
- **Minimal core** — only the block primitives ship by default (`if`, `unless`, `with`, `each`, `return`); add your own with `addHelper`.
- **Persistable AST** — versioned JSON; old ASTs fail loudly when the runner has moved on.

## Mustache spec compatibility

Bigodin is a Handlebars-flavored superset and is **not** a drop-in Mustache
implementation. Against the official [mustache/spec](https://github.com/mustache/spec)
suite, **103 / 110** attempted tests currently pass (94%); the remaining 84
spec tests live in 5 deliberately-skipped feature files (partials, dynamic-names,
set-delimiters, inheritance, lambdas) and 4 individual tests are skipped because
they require auto-walking the context stack — Bigodin uses Handlebars-style
strict scoping (use `$parent`/`$root` to walk up explicitly).

Detailed per-feature breakdowns — including failing test names, root-cause
analysis, and proposed implementations — live in
[`mustache-compat/`](/docs/mustache-compat).

| Feature                                  | Status        | Notes |
| ---------------------------------------- | ------------- | ----- |
| Variable interpolation `{{x}}`           | Supported     | Output is **never HTML-escaped** by default — register an escape helper if needed |
| Sections `{{#x}}…{{/x}}`                 | Supported     | Empty arrays falsy on negated branch; truthy scalars do **not** push as context (Handlebars-style); use `$parent`/`$root` to walk the context stack |
| Inverted sections `{{^x}}…{{/x}}`        | Supported     | Empty arrays correctly treated as falsy |
| Comments `{{! … }}`                      | Supported     | Standalone-line whitespace is stripped |
| Triple mustache `{{{x}}}`                | Supported     | Output is identical to `{{x}}` (Bigodin never HTML-escapes by default) |
| Ampersand `{{&x}}`                       | Supported     | Output is identical to `{{x}}` |
| Standalone-line whitespace stripping     | Supported     | Applied to comments and section open/close tags — see [standalone-line-whitespace.md](/docs/mustache-compat/standalone-line-whitespace) |
| Implicit iterator `{{.}}`                | Supported     | Resolves to current context (alias of `{{$this}}`) — see [implicit-iterator.md](/docs/mustache-compat/implicit-iterator) |
| Block heads with literal-named keys      | Supported     | `{{#null}}` / `{{#true}}` / `{{#false}}` / `{{#undefined}}` look up the matching key in context |
| HTML Escaping for `{{x}}`                | Not supported | Bigodin emits raw output; register an escape helper if needed |
| Auto context-stack walk on missing keys  | Not supported | Bigodin uses strict scoping — use `$parent`/`$root` to walk explicitly |
| Set Delimiters `{{=<% %>=}}`             | Not planned   | See [set-delimiters.md](/docs/mustache-compat/set-delimiters) |
| Partials `{{>name}}`                     | Not planned   | See [partials.md](/docs/mustache-compat/partials) |
| Dynamic names `{{*name}}` (optional)     | Not planned   | Depends on partials — see [dynamic-names.md](/docs/mustache-compat/dynamic-names) |
| Inheritance `{{<p}}{{$b}}…` (optional)   | Not planned   | `$` collides with Bigodin's variable syntax — see [inheritance.md](/docs/mustache-compat/inheritance) |
| Lambdas (optional)                       | Not supported | Bigodin's helper API (`addHelper`) is the recommended alternative — see [lambdas.md](/docs/mustache-compat/lambdas) |

Run `yarn test:spec` to execute the full Mustache spec suite locally
(it clones [mustache/spec](https://github.com/mustache/spec) into
`test/mustache/` on first run).

## Known limitations / not supported

Things Bigodin **does not** do, by design or because they are out of scope. Read this before reaching for a workaround.

### Mustache features

- **No HTML escaping by default.** `{{x}}`, `{{{x}}}`, and `{{&x}}` all emit raw output. If you render to HTML, register an escape helper and call it explicitly (or wrap your template in one).
- **No automatic context-stack walking.** A missing key resolves to `undefined`, not the parent context. Walk up explicitly with `$parent` / `$root`.
- **No partials** (`{{>name}}`), **set-delimiters** (`{{=<% %>=}}`), **dynamic names** (`{{*name}}`), or **template inheritance** (`{{<p}}{{$b}}…`). See `mustache-compat/` for rationale.
- **No Mustache lambdas.** Functions placed in the rendering context are not invoked. Use `addHelper` instead — that is the supported extension point.

### Runtime / API

- **Templates are interpreted, never compiled.** You cannot get a JavaScript function out of a template; this is the security guarantee, not an oversight.
- **Helpers must be registered ahead of time** via `addHelper` (or the `extraHelpers` argument to `run`). Templates cannot define their own helpers, import code, or read files.
- **Module-level `parse`/`run`/`compile` exports do not carry custom helpers.** `addHelper` only mutates the instance it is called on — instantiate `new Bigodin()` if you need a registry of your own.
- **Only one runtime dependency** (`pierrejs`). New runtime deps are scrutinized; the value prop is "safe to run on user input".

### Security boundaries

- Helper names matching `__proto__`, `constructor`, `prototype`, etc. are rejected — registering or looking them up will throw. This is intentional anti-prototype-pollution behavior; do not work around it.
- The `data` channel on `Execution` is helper-only. Templates cannot read it; helpers can mutate it via `this.data` to share side-channel state.

If you need one of the unsupported Mustache features, open an issue — most "Not planned" entries have a design note in [`mustache-compat/`](/docs/mustache-compat) explaining the tradeoff.
