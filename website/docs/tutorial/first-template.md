---
title: 'Your first template'
sidebar_position: 1
---

This tutorial walks through every distinguishing Bigodin feature in one sitting. By the end you will have rendered a template, registered a custom helper, written an `async` helper that fetches data, persisted a parsed AST, and bounded execution time on hostile input. It assumes you have used Handlebars or Mustache before; if you have not, [Template language](/docs/language) is the gentler entry point.

You should be able to finish in about ten minutes. Each step builds on the previous one, so work through them in order.

## What you need

- Node.js ≥ 20
- A folder with `package.json` (or just `npm init -y`)

## Step 1 — Render a template

Install the package:

```bash npm2yarn
npm install @jpbm135/bigodin
```

Create `step-1.mjs`:

```javascript
import { compile } from '@jpbm135/bigodin';

const template = compile('Hello, {{name}}!');
const result = await template({ name: 'George' });

console.log(result);
```

Run it:

```bash
node step-1.mjs
```

You should see `Hello, George!`. The exported `compile`, `parse`, and `run` functions come bound to a default singleton instance and use only the bundled block helpers (`if`, `unless`, `with`, `each`, `return`).

## Step 2 — Register a custom helper

The module-level `compile` cannot see helpers you register. To add a helper you instantiate `Bigodin` directly:

```javascript
import Bigodin from '@jpbm135/bigodin';

const bigodin = new Bigodin();
bigodin.addHelper('shout', (s) => String(s).toUpperCase());

const template = bigodin.compile('Hello, {{shout name}}!');
console.log(await template({ name: 'world' }));
// "Hello, WORLD!"
```

Helpers are positional: `{{shout name}}` calls `shout(value_of_name)`. They can take any number of arguments, mix literals (`{{shout "static text"}}`), and nest with parentheses (`{{shout (firstWord text)}}`).

## Step 3 — Make a helper async

Helpers return values directly or as promises. Bigodin awaits them transparently:

```javascript
import Bigodin from '@jpbm135/bigodin';

async function fetchUser(id) {
  // pretend this is a real HTTP or DB call
  await new Promise((r) => setTimeout(r, 50));
  return { name: 'George', city: 'Lisbon' };
}

const bigodin = new Bigodin();
bigodin.addHelper('user', async (id) => fetchUser(id));

const template = bigodin.compile('{{#with (user id)}}{{name}} from {{city}}{{/with}}');
console.log(await template({ id: 42 }));
// "George from Lisbon"
```

Two things are happening here. The `user` helper resolves a promise; Bigodin awaits it before feeding the result to `with`. The `with` block then pushes that object as the current context, so `{{name}}` and `{{city}}` resolve against the user record.

If the helper throws, the run rejects with the original error. There is no swallowing.

## Step 4 — Persist the AST

Parsing is the expensive step. The parsed AST is plain JSON, so you can parse once and run many times, possibly across processes:

```javascript
import { parse, run } from '@jpbm135/bigodin';
import { writeFileSync, readFileSync } from 'node:fs';

// In your build step:
const ast = parse('Hello, {{name}}!');
writeFileSync('greeting.ast.json', JSON.stringify(ast));

// In your request handler, possibly in a different service:
const reloaded = JSON.parse(readFileSync('greeting.ast.json', 'utf8'));
console.log(await run(reloaded, { name: 'George' }));
// "Hello, George!"
```

The AST carries a `version` field. If a future Bigodin release changes the AST shape, the runner refuses old ASTs with a "parse it again" error rather than silently misinterpreting them. See [The AST contract](/docs/explanation/ast-and-versioning) for the full guarantee and how to handle the rejection.

## Step 5 — Bound execution time

Bigodin is meant to run user-supplied templates. A hostile or buggy template can loop forever inside a helper, so the runner accepts a `maxExecutionMillis` budget and exposes a cooperative `{{return}}` block:

```javascript
import Bigodin from '@jpbm135/bigodin';

const bigodin = new Bigodin();
bigodin.addHelper('slow', async () => {
  await new Promise((r) => setTimeout(r, 200));
  return 'done';
});

const template = bigodin.compile('Result: {{slow}}');

try {
  await template({}, { maxExecutionMillis: 50 });
} catch (err) {
  console.error(err.message);
  // execution exceeded 50ms
}
```

For cooperative early exit, drop a `{{return}}` into the template:

```javascript
const template = bigodin.compile('Hello{{#if shouldStop}}{{return}}{{/if}}, world!');

console.log(await template({ shouldStop: true }));
// "Hello"
```

A custom helper can do the same programmatically with `this.halt()`. See [Bound execution time](/docs/how-to/bound-execution-time) for the full set of patterns.

## Step 6 — Recap

You have now seen the four things that make Bigodin different from a generic Mustache implementation:

1. **Helpers can be `async`** without changing how templates look.
2. **The parsed AST is plain JSON** and can be persisted, shipped over the network, or cached.
3. **Execution time is bounded.** `maxExecutionMillis`, `{{return}}`, and `this.halt()` cooperate to stop a runaway render.
4. **Templates are interpreted, never compiled.** No `eval`, no `Function`, no codegen. This is the security guarantee, not an oversight; it lives in [Why interpret, not compile](/docs/explanation/security-model).

Where to go next:

- The [how-to guides](/docs/how-to/render-html-safely) cover specific problems: rendering HTML safely, caching ASTs across services, writing async helpers that hit external systems, migrating from Mustache.
- The [Library API](/docs/lib) and [Template language](/docs/language) references describe every public surface.
- The [Mustache spec compatibility](/docs/mustache-compat) section lists every feature Bigodin supports, omits, or deliberately diverges from.
