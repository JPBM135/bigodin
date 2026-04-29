---
title: 'Introduction'
slug: '/'
sidebar_position: 1
---

**Bigodin** is a Handlebars/Mustache-flavored templating library built to safely evaluate templates submitted by end users. Templates are parsed into a JSON AST and **interpreted** at runtime, never compiled to JavaScript. Helpers may be `async`. Parse errors carry line and column.

Bigodin is a fork of [Bigodon](https://github.com/gabriel-pinheiro/bigodon) that drops unnecessary features and grows the supported subset of the Mustache spec. If you have used Handlebars or Mustache before, you can read the [tutorial](/docs/tutorial/first-template) end-to-end in about ten minutes.

## Install

```bash npm2yarn
npm install @jpbm135/bigodin
```

Types are bundled. Node ≥ 20 is required.

## Hello, world

```javascript
const { compile } = require('@jpbm135/bigodin');

const template = compile('Hello, {{name}}!');
const result = await template({ name: 'George' });
// "Hello, George!"
```

To register custom helpers, instantiate `new Bigodin()`:

```javascript
const Bigodin = require('@jpbm135/bigodin').default;

const bigodin = new Bigodin();
bigodin.addHelper('shout', (s) => String(s).toUpperCase());

const template = bigodin.compile('Hello, {{shout name}}!');
await template({ name: 'world' }); // "Hello, WORLD!"
```

## Where to next

- **New here?** Walk through the [tutorial](/docs/tutorial/first-template) to see every distinguishing feature in one sitting.
- **Solving a problem?** The [how-to guides](/docs/how-to/render-html-safely) cover safe HTML rendering, AST caching, execution limits, async helpers, and migration from Mustache.
- **Looking up a name?** The [Library API](/docs/lib), [Template language](/docs/language), and [Block helpers](/docs/helpers) references describe every public surface.
- **Curious about the design?** [Why Bigodin interprets and never compiles](/docs/explanation/security-model) and [The AST contract](/docs/explanation/ast-and-versioning) explain the choices behind the library.
- **Coming from Mustache?** The [Mustache spec compatibility](/docs/mustache-compat) section lists every supported and unsupported feature, with rationale.
