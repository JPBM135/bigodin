---
title: 'Iteration variables'
slug: '/language/iteration-variables'
sidebar_position: 7
---

Inside a [loop block](/docs/language/loop-blocks), four Handlebars-style `@`-prefixed variables expose the iteration state:

| Variable     | Type    | Meaning                                                  |
| ------------ | ------- | -------------------------------------------------------- |
| `{{@index}}` | number  | Zero-based index of the current iteration                |
| `{{@key}}`   | number  | Same as `@index` for arrays (kept for Handlebars parity) |
| `{{@first}}` | boolean | `true` on the first iteration, `false` otherwise         |
| `{{@last}}`  | boolean | `true` on the last iteration, `false` otherwise          |

Outside a loop, all of these resolve to `undefined` (and render as empty strings).

## Example: rendering a comma-separated list

```hbs
{{#items}}{{#if @first}}[{{/if}}{{@index}}:{{$this}}{{#if @last}}]{{else}}, {{/if}}{{/items}}
```

With context `{ "items": ["a", "b", "c"] }` the output is `[0:a, 1:b, 2:c]`.

## Example: alternating row classes

```hbs
{{#each rows}}
<tr class="{{#if @first}}first {{/if}}{{#if @last}}last{{/if}}">
    <td>{{@index}}</td>
    <td>{{name}}</td>
</tr>
{{/each}}
```

## Nesting

When loops are nested, the inner iteration **shadows** the outer one. The inner block sees its own `@index` / `@first` / `@last`; the outer values are not directly reachable.

```hbs
{{#each groups}}
  Group
  {{@index}}:
  {{name}}
  {{#each items}}
    {{@index}}.
    {{$this}}
  {{/each}}
{{/each}}
```

There is no `@../index` syntax to reach the outer loop's index. If you need it, capture it in a [variable](/docs/language/variables) before entering the inner loop:

```hbs
{{#each groups}}
    {{= $groupIndex @index}}
    Group {{@index}}: {{name}}
    {{#each items}}
        Outer {{$groupIndex}}, inner {{@index}}: {{$this}}
    {{/each}}
{{/each}}
```

## Why `@key`?

Handlebars uses `@key` for object iteration (where the key is a string) and `@index` for array iteration (where the key is a number). Bigodin does not iterate objects directly — there is no `{{#each obj}}` over an object's keys — so `@key` is exposed as an alias of `@index` purely for template portability.
