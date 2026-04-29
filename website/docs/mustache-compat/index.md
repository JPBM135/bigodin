---
title: 'Overview'
slug: '/mustache-compat'
sidebar_position: 0
---

Bigodin is a Handlebars-flavored superset and is **not** a drop-in Mustache implementation. Against the official [mustache/spec](https://github.com/mustache/spec) suite, **103 / 110** attempted tests currently pass (94%); the remaining 84 spec tests live in 5 deliberately-skipped feature files (partials, dynamic-names, set-delimiters, inheritance, lambdas), 3 `HTML Escaping` variants are skipped because Bigodin emits raw output by default, and 4 individual tests are skipped because they require auto-walking the context stack (Bigodin uses Handlebars-style strict scoping; use `$parent` / `$root` to walk up explicitly).

This directory documents Bigodin's per-feature compatibility. Each sub-doc describes what is supported, what is not, and (for unsupported features) why.

## At a glance

| Feature                                  | Status        | Notes                                                                                                                                                 |
| ---------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Variable interpolation `{{x}}`           | Supported     | Output is **never HTML-escaped** by default; register an escape helper if needed (see [Render HTML safely](/docs/how-to/render-html-safely))          |
| Sections `{{#x}}...{{/x}}`               | Supported     | Empty arrays falsy on negated branch; truthy scalars do **not** push as context (Handlebars-style); use `$parent` / `$root` to walk the context stack |
| Inverted sections `{{^x}}...{{/x}}`      | Supported     | Empty arrays correctly treated as falsy                                                                                                               |
| Comments `{{! ... }}`                    | Supported     | Standalone-line whitespace is stripped                                                                                                                |
| Triple mustache `{{{x}}}`                | Supported     | Output is identical to `{{x}}` (Bigodin never HTML-escapes by default)                                                                                |
| Ampersand `{{&x}}`                       | Supported     | Output is identical to `{{x}}`                                                                                                                        |
| Standalone-line whitespace stripping     | Supported     | Applied to comments and section open / close tags; see [standalone-line-whitespace.md](/docs/mustache-compat/standalone-line-whitespace)              |
| Implicit iterator `{{.}}`                | Supported     | Resolves to current context (alias of `{{$this}}`); see [implicit-iterator.md](/docs/mustache-compat/implicit-iterator)                               |
| Block heads with literal-named keys      | Supported     | `{{#null}}` / `{{#true}}` / `{{#false}}` / `{{#undefined}}` look up the matching key in context                                                       |
| HTML escaping for `{{x}}`                | Not supported | Bigodin emits raw output; register an escape helper if needed                                                                                         |
| Auto context-stack walk on missing keys  | Not supported | Bigodin uses strict scoping; use `$parent` / `$root` to walk explicitly                                                                               |
| Set Delimiters `{{=<% %>=}}`             | Not planned   | See [set-delimiters.md](/docs/mustache-compat/set-delimiters)                                                                                         |
| Partials `{{>name}}`                     | Not planned   | See [partials.md](/docs/mustache-compat/partials)                                                                                                     |
| Dynamic names `{{*name}}` (optional)     | Not planned   | Depends on partials; see [dynamic-names.md](/docs/mustache-compat/dynamic-names)                                                                      |
| Inheritance `{{<p}}{{$b}}...` (optional) | Not planned   | `$` collides with Bigodin's variable syntax; see [inheritance.md](/docs/mustache-compat/inheritance)                                                  |
| Lambdas (optional)                       | Not supported | Bigodin's helper API (`addHelper`) is the recommended alternative; see [lambdas.md](/docs/mustache-compat/lambdas)                                    |

Run `yarn test:spec` to execute the full Mustache spec suite locally (it clones [mustache/spec](https://github.com/mustache/spec) into `test/mustache/` on first run).

## Status snapshot

Run on `main` against the current `dist/` build:

- **Passing: 103 / 110** attempted Mustache spec tests (94%)
- **Failing: 0**
- **Skipped: 84 + 7**, broken down as:
  - 84 tests in 5 unimplemented feature files (`partials.json`, `~dynamic-names.json`, `delimiters.json`, `~inheritance.json`, `~lambdas.json`)
  - 3 `HTML Escaping` variants - deliberate divergence (Bigodin emits raw output by default)
  - 4 tests requiring auto context-stack walking (`Parent contexts`, `List Contexts`, `Deeply Nested Contexts`, `Variable test`) - Bigodin uses Handlebars-style strict scoping
- Test runner: `yarn test:spec` (clones `mustache/spec` into `test/mustache/`, executes `test/spec.spec.ts`)

### What's implemented

- Implicit iterator `{{.}}` - resolves to the current context (alias of `{{$this}}`)
- Inverted-section empty-array falsy check
- Triple mustache `{{{x}}}` and ampersand `{{&x}}` parsed as raw-emit aliases of `{{x}}`
- Block heads with literal-named keys (`{{#null}}` etc.) resolve as paths
- Standalone-line whitespace stripping for comments and block open/close tags

### What's deliberately skipped

- The 5 feature files above - see the per-category docs in this directory
- HTML escaping for `{{x}}` - Bigodin emits raw output; the spec's `HTML Escaping` tests therefore fail by design
- Truthy-scalar context push (`{{#scalar}}{{.}}{{/scalar}}`) - Bigodin's existing semantic is "don't change context for non-object values"
- Auto walk of context stack - use explicit `$parent` / `$root` instead

## Categories

| #   | Category                                                  | Status                  | Doc                                                                                     |
| --- | --------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| 1   | Triple mustache `{{{x}}}` and ampersand `{{&x}}`          | Supported               | [triple-mustache-and-ampersand.md](/docs/mustache-compat/triple-mustache-and-ampersand) |
| 2   | Standalone-line whitespace stripping                      | Supported               | [standalone-line-whitespace.md](/docs/mustache-compat/standalone-line-whitespace)       |
| 3   | Implicit iterator `{{.}}`                                 | Supported               | [implicit-iterator.md](/docs/mustache-compat/implicit-iterator)                         |
| 4   | Section context & falsy edge cases                        | Mostly supported        | [section-falsy-and-context.md](/docs/mustache-compat/section-falsy-and-context)         |
| 5   | Set Delimiters `{{=<% %>=}}`                              | Not planned             | [set-delimiters.md](/docs/mustache-compat/set-delimiters)                               |
| 6   | Partials `{{>name}}`                                      | Not planned             | [partials.md](/docs/mustache-compat/partials)                                           |
| 7   | Dynamic names `{{*name}}` (optional)                      | Not planned             | [dynamic-names.md](/docs/mustache-compat/dynamic-names)                                 |
| 8   | Inheritance `{{<parent}}{{$block}}{{/parent}}` (optional) | Not planned             | [inheritance.md](/docs/mustache-compat/inheritance)                                     |
| 9   | Lambdas (optional)                                        | Not supported           | [lambdas.md](/docs/mustache-compat/lambdas)                                             |

Categories 1, 2, 3 ship the Mustache feature behind Bigodin's existing parser; category 4 is mostly aligned with the spec, with the documented exceptions of truthy-scalar context-push and auto context-stack walk. Categories 5–9 are new features Bigodin does not (and in most cases will not) provide.

## Versioning notes

Bigodin's parser emits a `version` field on the AST root (`src/parser/index.ts`, currently `VERSION = 4`). The runner enforces a `MIN_VERSION = 1`, `MAX_VERSION = 4` window (`src/runner/index.ts`). Any change that alters the AST shape (adding a new statement type, adding fields to existing statements, etc.) must bump `VERSION` and widen `MAX_VERSION`. Old persisted ASTs outside the window fail loudly with a "parse it again" error; this is intentional and must be preserved.

## Test runner

`test/spec.spec.ts` controls what runs via two top-level lists:

```ts
const SKIPPED_SPECS = [
    'partials.json',
    '~dynamic-names.json',
    'delimiters.json',
    '~inheritance.json',
    '~lambdas.json',
];

const SKIPPED_FEATURES = [
    'Parent contexts',
    'List Contexts',
    'Deeply Nested Contexts',
    'Variable test',
    'HTML Escaping',
];
```

`SKIPPED_SPECS` skips an entire spec file; `SKIPPED_FEATURES` skips individual tests whose name contains the given substring (case-insensitive). If a category here is decided to be permanently out of scope, add the spec file or feature name to the appropriate list.
