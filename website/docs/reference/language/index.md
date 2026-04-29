---
title: 'Template language'
slug: '/language'
sidebar_position: 0
---

A Bigodin template is a string that produces an **output** when given a **context**. The context is a JSON-like value: numbers, strings, booleans, arrays, objects. The template references context fields, calls registered helpers, branches on conditions, and loops over arrays.

This section is a reference for the template-side syntax. For the host-side API (`compile`, `parse`, `run`, `addHelper`) see [Library API](/docs/lib); for the bundled block primitives (`if`, `unless`, `with`, `each`, `return`) see [Block helpers](/docs/helpers).

## Quick example

```hbs
{{#if user.active}}
  Welcome,
  {{user.name}}! Your last 3 orders:
  {{#each (slice user.orders 0 3)}}
    -
    {{@index}}.
    {{this.product}}
    ({{this.total}})
  {{/each}}
{{else}}
  Account inactive.
{{/if}}
```

## Topics

- [Path expressions](/docs/language/path-expressions): reading values from the context with `{{name}}` and dot notation
- [Comments](/docs/language/comments): `{{! ... }}` and the standalone-line rule
- [Raw output](/docs/language/raw-output): `{{x}}`, `{{{x}}}`, `{{&x}}` and why they all emit raw
- [Calling helpers](/docs/language/helpers): positional args, literals, and nested expressions
- [Conditional blocks](/docs/language/conditional-blocks): truthy / falsy sections, `{{else}}`, and `{{else if}}`
- [Loop blocks](/docs/language/loop-blocks): iterating over arrays
- [Iteration variables](/docs/language/iteration-variables): `@index`, `@key`, `@first`, `@last`
- [Negated blocks](/docs/language/negated-blocks): `{{^name}}...{{/name}}`
- [Context blocks](/docs/language/context-blocks): pushing context, walking with `$parent` / `$root` / `$this`
- [Variables](/docs/language/variables): `{{= $name value}}` and reuse across statements

If you are coming from Mustache, also read [Migrate from Mustache](/docs/how-to/migrate-from-mustache) for a list of behavioral differences.
