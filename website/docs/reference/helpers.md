---
title: 'Block helpers'
slug: '/helpers'
sidebar_position: 3
---

Bigodin ships only the **block primitives** wired to template syntax. String, math, date, array, and comparison helpers were removed in 3.0.0; register your own with `bigodin.addHelper(name, fn)`. See [Library API](/docs/lib) for `addHelper` and the [tutorial](/docs/tutorial/first-template) for a worked example.

| Helper              | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| [`if`](#if)         | Run a block when the value is truthy. Does not change context.          |
| [`unless`](#unless) | Run a block when the value is falsy. Does not change context.           |
| [`with`](#with)     | Run a block once with the value as the new context.                     |
| [`each`](#each)     | Iterate a block over an array (or once over a non-array).               |
| [`return`](#return) | Halt the execution; the template returns what has been rendered so far. |

---

## `if`

```handlebars
{{#if user.active}}
  Welcome,
  {{user.name}}!
{{else}}
  Account inactive.
{{/if}}
```

Coerces the argument to a boolean. The body runs when truthy; an optional `{{else}}` branch runs when falsy. Context is not changed inside the block.

`if` chains via `{{else if ...}}`:

```handlebars
{{#if (eq country 'BR')}}
  Brazil
{{else if (eq country 'US')}}
  United States
{{else}}
  Other
{{/if}}
```

## `unless`

```handlebars
{{#unless user.banned}}
  Hello,
  {{user.name}}.
{{else}}
  Access denied.
{{/unless}}
```

Inverse of `if`. The body runs when the argument is falsy.

## `with`

```handlebars
{{#with user.address}}
  {{street}},
  {{city}}
{{/with}}
```

Pushes the argument as the current context for the duration of the block. Inside, `{{$this}}` and bare paths resolve against the new context. The block runs exactly once. Falsy values render nothing.

## `each`

```handlebars
{{#each items}}
  -
  {{$this}}
{{/each}}
```

Iterates over an array, pushing each element as the current context. A non-array argument is treated as a single-element list (the block runs once with that value as context). Empty arrays render nothing.

## `return`

```handlebars
Hello{{#if shouldStop}}{{return}}{{/if}}, world!
```

Halts the rest of the template. The runner returns whatever output has accumulated up to that point. The programmatic equivalent for a custom helper is `this.halt()`; see [Library API](/docs/lib#execution-the-helper-this).
