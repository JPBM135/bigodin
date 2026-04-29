---
title: 'Lambdas (optional)'
sidebar_position: 4
---

**Status: Not supported. Bigodin's `addHelper` API is the deliberate alternative.**

## Summary

Mustache lambdas are an _optional_ feature where the template data contains a function. The spec defines two distinct behaviors:

- **Interpolation lambda** (`{{lambda}}`): the function is called with no arguments; its **return value is re-parsed as a Mustache template with the current context** and the result substituted. Calls are cached per-template-position.
- **Section lambda** (`{{#lambda}}...{{/lambda}}`): the function is called with the **raw (unrendered) section body** as a string argument; its return value is rendered as a template. Calls are _not_ cached.

Bigodin has a function-call mechanism (helpers, registered via `addHelper`), but its semantics differ from Mustache lambdas in two material ways:

1. Helper return values are emitted as-is, **not re-parsed**.
2. Block helpers (`{{#helper ...}}...{{/helper}}`) receive a structured call interface, not the raw template body string.

`~lambdas.json` is in `SKIPPED_SPECS` (`test/spec.spec.ts`); its 10 tests count toward the file-level skip total in the [overview](/docs/mustache-compat).

## Why not supported

Lambdas execute caller-supplied JavaScript inside the runtime _and_ ask the runtime to re-parse strings the lambda returned. Both pieces conflict with Bigodin's design goals:

- **Re-parsing user-controlled strings** would weaken the "safely interpret user templates" framing that motivates the project. If the lambda is itself derived from untrusted input, the re-parsed template is also untrusted, and `maxExecutionMillis` would have to wrap every re-parse to keep the runtime bounded.
- **The "raw body string" semantics** require plumbing the original template source through the runner alongside the AST so the section lambda can receive `source.slice(start, end)`. The runner currently operates on the AST alone, so this is a non-trivial change to how Bigodin separates parsing from execution.
- **Helpers already cover the use case.** Computing values, formatting, and conditional rendering are all what `addHelper` is for. The structured call interface (`this`, named params, parameter expressions) is more ergonomic for typical use than receiving an unparsed body string.

## Recommended alternative: `addHelper`

For interpolation lambdas, register a helper that returns the value:

```js
bigodin.addHelper('greet', (name) => `Hello, ${name}!`);
```

```handlebars
{{greet user.name}}
```

For section lambdas (running a block conditionally or iteratively over a value), use a block helper. Bigodin's built-in `if`, `unless`, `with`, and `each` are the canonical examples; a custom helper returns a value that drives the surrounding block:

```js
bigodin.addHelper('hasItems', (list) => Array.isArray(list) && list.length > 0);
```

```handlebars
{{#hasItems items}}You have {{items.length}} items{{/hasItems}}
```

For computed string output, register an interpolation helper instead of trying to mutate the body:

```js
bigodin.addHelper('upper', (s) => String(s).toUpperCase());
```

```handlebars
{{upper greeting}}
```

See the [Block helpers reference](/docs/helpers) for the built-in block primitives (`if`, `unless`, `with`, `each`) and the [Library API](/docs/lib) for `addHelper`.
