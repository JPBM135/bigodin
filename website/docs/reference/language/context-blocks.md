---
title: 'Context blocks'
slug: '/language/context-blocks'
sidebar_position: 9
---

A "context block" is a block whose body sees a different context than the one outside it. There are three ways the context changes:

1. The block's value is an **object** — the object becomes the new context.
2. The block's value is an **array** — each element becomes the new context for one iteration (see [Loop blocks](/docs/language/loop-blocks)).
3. The block uses the bundled `with` helper — each truthy argument becomes a new frame on the context stack, even if it is not an object. Multiple arguments are supported; see [Block helpers reference](/docs/helpers#with).

Inside the block you can still reach the outer context with `$parent` or `$root`.

## Object value

Bare-name blocks treat object values as a context push:

```hbs
{{#parent}}
  Hello,
  {{name}}!
{{/parent}}
```

<details>
<summary>Context and output</summary>

### Context

```json
{
  "name": "George",
  "parent": {
    "name": "Alice"
  }
}
```

### Generated output

```
Hello, Alice!
```

</details>

`{{name}}` resolves against the pushed `parent` object, so it picks up `"Alice"`, not the outer `"George"`.

## Truthy non-object value

A truthy value that is **not** an object does not push context. The body runs once, with the surrounding context still in scope. To force "treat this scalar as the new context," use `with`:

```hbs
{{#with parent}}
  Hello,
  {{$this}}!
{{/with}}
```

<details>
<summary>Context and output</summary>

### Context

```json
{
  "name": "George",
  "parent": 5
}
```

### Generated output

```
Hello, 5!
```

</details>

This is a deliberate Handlebars-style behavior; classic Mustache pushes scalars too. See [Mustache spec compatibility](/docs/mustache-compat) for the divergence.

## Conditional without context push

`if` evaluates its argument as truthy / falsy and **does not** push context, even when the argument is an object:

```hbs
{{#if parent}}
  Hello,
  {{name}}!
{{/if}}
```

<details>
<summary>Context and output</summary>

### Context

```json
{
  "name": "George",
  "parent": {
    "name": "Alice"
  }
}
```

### Generated output

```
Hello, George!
```

</details>

`name` resolves against the outer context (`"George"`) because `if` did not change the scope. This is the standard pattern for "render the surrounding template only when a related object exists."

## Walking the context: `$parent`, `$root`, `$this`

Every block (loop, context, even a positional block helper that pushes context) creates a new entry on the **context stack**. Three special names walk the stack:

| Name      | Aliases     | Resolves to                     |
| --------- | ----------- | ------------------------------- |
| `$this`   | `this`, `.` | The current (innermost) context |
| `$parent` | `../`       | One level up the stack          |
| `$root`   | `@root`     | The outermost context           |

`$parent` chains: `{{$parent.$parent.foo}}` walks two levels up. The Handlebars `../` form chains the same way: `{{../../foo}}`.

```hbs
{{name}}, your comments:

{{#comments}}
    From {{author}} to {{../name}}:
    {{comment}}
{{/comments}}
```

<details>
<summary>Context and output</summary>

### Context

```json
{
  "name": "George",
  "comments": [
    {
      "author": "Alice",
      "comment": "Nice presentation"
    },
    {
      "author": "Bob",
      "comment": "Thanks for the feedbacks"
    }
  ]
}
```

### Generated output

```
George, your comments:

    From Alice to George:
    Nice presentation
    From Bob to George:
    Thanks for the feedbacks
```

</details>

`{{../name}}` and `{{$parent.name}}` are interchangeable; they produce identical ASTs.

## A note on `this` as a property name

Because `this` is a reserved alias for `$this`, `{{this}}` and `{{this.foo}}` resolve to the **current context**, not to context keys literally named `"this"`. If your data contains a key called `this`, reach it via a parent path (`{{$parent.this}}` after a block push) or rename the field. Templates that do not use `this` as a property name are unaffected.
