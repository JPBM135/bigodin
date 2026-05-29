---
title: 'Block params'
slug: '/language/block-params'
sidebar_position: 12
---

A block head may end with `as |name1 name2|` to bind local names to the values the block yields. The names are scoped to the block body (and any blocks nested inside it) and **shadow** context keys of the same name.

```hbs
{{#each users as |user index|}}
  {{index}}.
  {{user.name}}
{{/each}}
```

<details>
<summary>Context and output</summary>

### Context

```json
{ "users": [{ "name": "Alice" }, { "name": "Bob" }] }
```

### Generated output

```
0. Alice
1. Bob
```

</details>

This is the Handlebars block-params syntax. It is most useful for naming the current item and index so you can reach them by name from inside nested blocks, instead of relying on `$parent` / `$root` or capturing [variables](/docs/language/variables).

## What the names bind to

The values come from what the block does with its argument, so block params work on every block form:

| Block                                        | `as \|a b\|` binds                               |
| -------------------------------------------- | ------------------------------------------------ |
| Array loop (`{{#each xs}}`, `{{#xs}}`)       | `a` = current element, `b` = index (number)      |
| Object context (`{{#with obj}}`, `{{#obj}}`) | `a` = the object, `b` = `undefined`              |
| Truthy scalar section                        | `a` = the value, `b` = `undefined`               |
| Multi-argument `{{#with x y}}`               | `a` = `x`, `b` = `y` (one name per pushed frame) |

Names with no corresponding value resolve to `undefined`. Because the values are derived from how the block renders its argument, declaring `as |...|` works on custom-helper blocks too — the params bind to the helper's return value as the block renders it.

```hbs
{{#with account as |acct|}}
  {{acct.owner}}
  —
  {{acct.balance}}
{{/with}}
```

## Shadowing and precedence

Inside the body, a bare name (or the first segment of a dotted path) resolves to a block param before the surrounding context:

```hbs
{{#each items as |item|}}
  {{item}}
{{/each}}
```

…renders the array elements even if the context also has a key named `item`.

Block params do **not** shadow the prefixed namespaces — `@index`, `@key`, `@first`, `@last`, `$parent`, `$root`, `$this`, and `$`-variables keep their meaning. Inner declarations shadow outer ones:

```hbs
{{#each rows as |row r|}}
  {{#each row as |cell c|}}
    {{r}},{{c}}:
    {{cell}}
  {{/each}}
{{/each}}
```

Both `r` (outer index) and `c` (inner index) are reachable by name from the inner body — something the `@index` variable alone cannot do, since it always refers to the innermost loop (see [Iteration variables](/docs/language/iteration-variables)).

## Notes

- The clause goes only on a block **opener**. A closing tag (`{{/each}}`) or a bare `{{else}}` may not declare block params.
- Names follow the usual identifier rules (letters, digits, underscores; not starting with a digit).
- `as` is only treated as a block-params keyword when it is immediately followed by `|`. A helper argument that happens to be the path `as` still parses normally.
