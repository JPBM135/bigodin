---
title: 'Library API'
slug: '/lib'
sidebar_position: 1
---

The complete public API of `@jpbm135/bigodin`. For a guided walkthrough see the [tutorial](/docs/tutorial/first-template); for template syntax see [Template language](/docs/language); for the bundled block helpers see [Block helpers](/docs/helpers).

## Module exports

```javascript
const Bigodin = require('@jpbm135/bigodin').default;
const {
  compile,
  compileExpression,
  parse,
  parseExpression,
  run,
  runExpression,
} = require('@jpbm135/bigodin');
```

```typescript
import Bigodin, {
  compile,
  compileExpression,
  parse,
  parseExpression,
  run,
  runExpression,
} from '@jpbm135/bigodin';
```

The named exports are convenience functions bound to a default singleton instance. They use the bundled block helpers but **do not** see helpers registered via `addHelper` on user instances. Whenever you need custom helpers, use `new Bigodin()` and call `compile`/`parse`/`run` on that instance.

## `class Bigodin`

```typescript
const bigodin = new Bigodin();
```

Each instance owns its own helper registry. The instance methods mirror the module-level functions; the difference is that an instance's `compile`/`run` see its registered helpers.

### `bigodin.addHelper(name, fn)`

Register a helper for this instance.

- **`name: string`** must not match `__proto__`, `constructor`, `prototype`, or any other key blocked by `UNSAFE_KEYS`. Registering a forbidden name throws.
- **`fn: (...args) => any | Promise<any>`** receives the `Execution` instance as `this` (see below). May be `async`. Non-string returns are coerced to string at the interpolation site.

Registering a helper with a name that already exists overwrites it. User helpers shadow built-in block helpers with the same name, and shadow context paths of the same name (a registered `name` helper wins over a `name` field in the context).

### `bigodin.compile(source)`

Parse `source` once and return a runner: `(context?, options?) => Promise<string>`. Equivalent to `(ctx, opts) => run(parse(source), ctx, undefined, opts)` for this instance.

### `bigodin.parse(source)`

Parse `source` into a `TemplateStatement` AST. The result is plain JSON, safe to `JSON.stringify` and persist. Throws `BigodinParseError` on invalid syntax with `line` / `column` and an "expected ..." message.

### `bigodin.run(ast, context?, extraHelpers?, options?)`

Interpret a previously parsed AST. Returns `Promise<string>`.

- **`ast`** is the output of `parse`, possibly round-tripped through JSON. The runner enforces a `[MIN_VERSION, MAX_VERSION]` window on `ast.version`; ASTs outside that window throw with a "parse it again" message. See [AST and versioning](/docs/explanation/ast-and-versioning).
- **`context`** is the root rendering context. Any JSON-like value.
- **`extraHelpers`** is an optional `Record<string, Helper>` merged on top of the instance's helpers for this run only.
- **`options`** is documented under `RunOptions` below.

### `bigodin.parseExpression(source)`, `bigodin.runExpression(ast, context?, options?)`, `bigodin.compileExpression(source)`

Same as `parse` / `run` / `compile`, but for a single expression rather than a full template. Useful when you want to evaluate one mustache-shaped value without surrounding text. The expression is the body of a `{{...}}` minus the braces.

## `RunOptions`

```typescript
interface RunOptions {
  maxExecutionMillis?: number;
  data?: Record<string, unknown>;
  allowDefaultHelpers?: boolean;
}
```

- **`maxExecutionMillis`** is checked at the top of every statement. When exceeded, the run throws. Use this to bound runtime on hostile input. See [Bound execution time](/docs/how-to/bound-execution-time).
- **`data`** is a side channel passed to helpers as `this.data`. Templates **cannot** read it; helpers may mutate it to surface structured data back to your code. See [Async helpers](/docs/how-to/async-helpers).
- **`allowDefaultHelpers`** defaults to `true`. Set to `false` to disable the bundled block helpers (`if`, `unless`, `with`, `each`, `return`). Helpers added via `addHelper` always run.

## `Execution` (the helper `this`)

Every helper is invoked with an `Execution` instance bound to `this`:

```typescript
bigodin.addHelper('myHelper', function (...args) {
  this.data; // the RunOptions.data object (may be undefined)
  this.halt(); // stop execution; the run returns whatever has been emitted so far
  this.contexts; // the context stack (read-only by convention)
  this.variables; // {{= $var ...}} assignments for this run
});
```

`halt()` is the programmatic counterpart to the `{{return}}` block. Mutating `this.data` is the supported way to return structured data from a render.

## Hash arguments

Helpers can receive Handlebars-style **hash arguments** (`key=value` pairs after the positional parameters):

```handlebars
{{link 'Sign up' target='_blank' rel='noopener'}}
```

When the call site uses any `key=value` pair, Bigodin appends a single null-prototype object (`{ target: "_blank", rel: "noopener" }`) as the **final** argument to the helper, after the positional ones. When no hash arguments are present, no extra argument is passed and the helper signature is unchanged.

```js
bigodin.addHelper('link', (label, options = {}) => {
  const attrs = Object.entries(options)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return `<a ${attrs}>${label}</a>`;
});
```

Hash values may be literals, paths, variables, or subexpressions, same as positional parameters. Positional parameters are not allowed after a hash argument, and duplicate keys are rejected at parse time.

## Block helper return values

A helper used as a block (`{{#myHelper x}}...{{/myHelper}}`) controls block rendering by what it returns:

| Returned value                                                 | Behavior                                                               |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Falsy (`false`, `null`, `undefined`, `0`, `''`) or empty array | The body is skipped; an `{{else}}` branch runs if present.             |
| Object                                                         | The body runs once with the returned object pushed as the new context. |
| Array (non-empty)                                              | The body runs once per element with each element pushed as context.    |
| Any other truthy value                                         | The body runs once with the parent context unchanged.                  |

```javascript
bigodin.addHelper('isEven', (value) => value % 2 === 0);

const tmpl = bigodin.compile('{{num}} is {{#isEven num}}even{{else}}odd{{/isEven}}');
await tmpl({ num: 2 }); // "2 is even"
await tmpl({ num: 3 }); // "3 is odd"
```

## Module-level helpers do not carry custom helpers

A repeated source of confusion:

```javascript
const { compile, addHelper } = require('@jpbm135/bigodin'); // there is no module-level addHelper
```

`addHelper` only exists on a `Bigodin` instance. The convenience exports `compile`, `parse`, `run`, etc. are bound to a default singleton you cannot mutate. To use custom helpers, always `new Bigodin()` and call methods on the instance.
