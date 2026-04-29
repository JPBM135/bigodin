---
title: 'Negated blocks'
slug: '/language/negated-blocks'
sidebar_position: 8
---

A negated block runs its body when the value is **falsy**. The opener is `{{^name}}`; the closer is the same `{{/name}}` you would use for a positive block:

```hbs
{{^name}}
You are not logged in
{{/name}}
```

The body runs when `name` is `null`, `undefined`, `false`, `0`, `''`, `NaN`, or an empty array. It is skipped for any truthy value.

## Empty arrays

An empty array is **falsy** in Bigodin (matching the Mustache rule that empty lists are absent). So:

```hbs
{{^items}}
You have no items.
{{/items}}
```

…runs over `{ "items": [] }`. The positive form `{{#items}}...{{/items}}` correctly does **not** run for empty arrays.

## Helpers as negated heads

Like positive blocks, negated blocks can use any helper as their head — most commonly the bundled `unless`:

```hbs
{{#unless user.banned}}
  Hello,
  {{user.name}}.
{{else}}
  Access denied.
{{/unless}}
```

`{{#unless x}}...{{else}}...{{/unless}}` is functionally `{{#if x}}...{{else}}...{{/if}}` with the branches swapped. See [Block helpers reference](/docs/helpers#unless).

## Literal-named keys

Inside `{{# ... }}` and `{{/ ... }}`, the names `null`, `true`, `false`, and `undefined` are treated as **context keys**, not as the literal value of the same name:

```hbs
{{#null}}
This block runs if the context has a key called "null" with a truthy value.
{{/null}}
```

This matters for templates ported from Mustache where data keys happen to use those names. If you want a conditional against the actual literal `null`, use the `if` helper:

```hbs
{{#if (eq value null)}}value is null{{/if}}
```

The same rule applies to negated blocks: `{{^null}}...{{/null}}` looks up the key `"null"`.
