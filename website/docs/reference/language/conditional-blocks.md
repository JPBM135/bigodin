---
title: 'Conditional blocks'
slug: '/language/conditional-blocks'
sidebar_position: 5
---

A block runs its body conditionally based on a value. Blocks open with `{{#name}}` and close with `{{/name}}`. The simplest form treats the value as a truthy / falsy switch:

```hbs
{{#name}}
  Hello,
  {{name}}!
{{/name}}
Welcome to our website :)
```

<details>
<summary>Context and output</summary>

With context `{"name": "George"}` the output is:

```
Hello, George!
Welcome to our website :)
```

With context `{}` or `{"name": null}` the output is:

```
Welcome to our website :)
```

</details>

There must be **no space** between the opening `{{` and the `#`. `{{ #name}}` is a syntax error.

## `{{else}}`

A conditional block may include an `{{else}}` branch that runs when the value is falsy:

```hbs
{{#name}}
  Hello,
  {{name}}!
{{else}}
  Hello, Stranger!
{{/name}}
```

<details>
<summary>Context and output</summary>

With context `{"name": "George"}` the output is `Hello, George!`.

With context `{}` or `{"name": null}` the output is `Hello, Stranger!`.

</details>

A block can have at most one `{{else}}` branch.

## Helpers as block heads

Any registered helper can be invoked as the head of a block. The bundled `if` helper is the canonical conditional:

```hbs
{{#if (eq name 'george')}}
  Hello, George!
{{else}}
  Hello, stranger!
{{/if}}
```

<details>
<summary>Context and output</summary>

With context `{"name": "george"}` the output is `Hello, George!`.

With context `{"name": "alice"}` the output is `Hello, stranger!`.

</details>

The full set of bundled block helpers (`if`, `unless`, `with`, `each`, `return`) is in [Block helpers reference](/docs/helpers). The return value of a block helper controls what the body sees; see [Block helper return values](/docs/lib#block-helper-return-values).

## `{{else if}}` chains

Instead of nesting `{{#if}}` inside `{{else}}`:

```hbs
{{#if (eq country 'BR')}}
  Brazil
{{else}}
  {{#if (eq country 'US')}}
    United States
  {{else}}
    Other
  {{/if}}
{{/if}}
```

…you can chain with `{{else if}}`:

```hbs
{{#if (eq country 'BR')}}
  Brazil
{{else if (eq country 'US')}}
  United States
{{else}}
  Other
{{/if}}
```

The two snippets are equivalent. The chain closes with a single `{{/if}}` matching the first opener — you do not write `{{/if}}` for each `{{else if}}`.

If the chain mixes helpers, you still close only the first one:

```hbs
{{#if (gt (length nickname) 16)}}
  Your nickname is too long :(
{{else if (eq (length nickname) 3)}}
  Your nickname is as long as "cat" :)
{{else}}
  "{{nickname}}" is
  {{length nickname}}
  chars long
{{/if}}
```

## What counts as truthy

The same coercion as JavaScript's `Boolean(value)`, with one Mustache-derived special case: an **empty array** is falsy. So `{{#items}}...{{/items}}` over `{ "items": [] }` skips the body, and `{{^items}}...{{/items}}` runs it (see [Negated blocks](/docs/language/negated-blocks)).

`null`, `undefined`, `false`, `0`, `NaN`, and `''` are falsy. Everything else (including `0n`-equivalent BigInts and non-empty objects) is truthy.
