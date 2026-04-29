---
title: 'Loop blocks'
slug: '/language/loop-blocks'
sidebar_position: 6
---

When a block's argument is an array, the body runs once per element with that element pushed as the current context:

```hbs
{{name}}, your comments:

{{#comments}}
  {{author}}
  wrote:
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

    Alice wrote:
    Nice presentation
    Bob wrote:
    Thanks for the feedbacks
```

</details>

The blank line between the title and the first iteration is preserved verbatim; the `{{#comments}}` and `{{/comments}}` tags themselves consume their own lines because they are [standalone](/docs/language/comments#standalone-lines).

## The current item

Inside the loop, bare path expressions resolve against the current element. Two short forms refer to the element as a whole:

| Form        | Notes                            |
| ----------- | -------------------------------- |
| `{{$this}}` | Bigodin canonical                |
| `{{this}}`  | Handlebars-style alias           |
| `{{.}}`     | Mustache-style implicit iterator |

```hbs
{{#keywords}}
  -
  {{$this}}
{{/keywords}}
```

<details>
<summary>Context and output</summary>

### Context

```json
{
  "keywords": ["lorem", "ipsum", "dolor"]
}
```

### Generated output

```
- lorem
- ipsum
- dolor
```

</details>

The three forms are interchangeable:

```hbs
{{#keywords}}- {{.}}
{{/keywords}}
```

…produces the same output.

## Empty arrays

An empty array is treated as falsy: the body of a `{{#items}}...{{/items}}` block does not run. Pair with `{{else}}` to render an empty-state message:

```hbs
{{#comments}}
  -
  {{author}}:
  {{comment}}
{{else}}
  No comments yet.
{{/comments}}
```

The negated form `{{^items}}...{{/items}}` runs the body for an empty array; see [Negated blocks](/docs/language/negated-blocks).

## Non-array values

If the value is **not** an array but is truthy and is an object, the block runs once with that object as context (see [Context blocks](/docs/language/context-blocks)). For other truthy values, the body runs once with the **parent** context unchanged. To force "treat this single value as the new context," use the `{{#with x}}...{{/with}}` block helper.

## Iteration variables

Inside a loop, four `@`-prefixed variables expose iteration state: `@index`, `@key`, `@first`, `@last`. See [Iteration variables](/docs/language/iteration-variables).

## Walking the context

A loop pushes a new context. To reach the surrounding context (the one outside the loop), use `$parent` or `$root`:

```hbs
{{#comments}}
  From
  {{author}}
  to
  {{$parent.name}}:
  {{comment}}
{{/comments}}
```

See [Context blocks](/docs/language/context-blocks) for the full set of context-walking variables.
