---
title: 'Raw output'
slug: '/language/raw-output'
sidebar_position: 3
---

Bigodin emits values as-is. The three Mustache interpolation forms are all equivalent:

```hbs
{{x}}
{{{x}}}
{{{x}}}
```

All three produce the same string. None of them HTML-escape, none of them apply any transformation. If `x` is the string `"<b>hi</b>"`, all three emit `<b>hi</b>` literally.

## Why three forms then?

The triple-mustache `{{{x}}}` and ampersand `{{&x}}` exist for **syntactic compatibility** with Mustache templates. In a Mustache implementation, `{{x}}` HTML-escapes and the other two forms exist to opt out. Bigodin does not HTML-escape by default, so there is nothing to opt out of; the alternate forms are accepted so that ported Mustache templates parse without modification.

If you are writing a new template, prefer the canonical `{{x}}`.

## Implications for HTML rendering

If you render the output into an HTML document with user-supplied context values, you must escape values yourself. The recommended pattern is a small `e` helper applied at every interpolation site; see [Render HTML safely](/docs/how-to/render-html-safely).

```hbs
<p>Hello, {{e name}}!</p>
```

## Coercion to string

Non-string values are coerced before emission:

| Value                | Renders as                                                  |
| -------------------- | ----------------------------------------------------------- |
| `null` / `undefined` | `""` (empty string)                                         |
| `true` / `false`     | `"true"` / `"false"`                                        |
| Number               | `String(n)`                                                 |
| Array                | `arr.join(',')` (rare; usually you want a loop)             |
| Object               | `[object Object]` (rare; usually you want a path or helper) |

If you need a specific format for a value, route it through a helper (`{{currency amount}}`, `{{date created_at}}`).
