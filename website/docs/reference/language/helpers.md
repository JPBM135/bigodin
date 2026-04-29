---
title: 'Calling helpers'
slug: '/language/helpers'
sidebar_position: 4
---

Helpers are functions registered on the host side and called from inside a mustache. Bigodin ships only the [block primitives](/docs/helpers) (`if`, `unless`, `with`, `each`, `return`); everything else is registered with `addHelper` (see [Library API](/docs/lib)).

This page is about how a helper is **called** from a template. For how to write a helper or register it, see the API reference.

## Basic call

A helper call is a name followed by zero or more arguments separated by spaces. The result of the call replaces the mustache:

```js
bigodin.addHelper('capitalize', (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1));
```

```hbs
Hello, {{capitalize name}}!
```

<details>
<summary>Context and output</summary>

### Context

```json
{
  "name": "george"
}
```

### Generated output

```
Hello, George!
```

</details>

Spaces inside the mustache are not significant: `{{capitalize name}}`, `{{ capitalize name }}`, and `{{capitalize  name }}` are equivalent.

## Multiple arguments

Pass arguments by listing them after the helper name. With a `default` helper that returns the first non-null argument:

```hbs
Hello, {{default name 'stranger'}}!
```

<details>
<summary>Context and output</summary>

With context `{"name": "George"}` the output is `Hello, George!`.

With context `{}` the output is `Hello, stranger!`.

</details>

Argument types:

| Form                    | Meaning                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| `name`                  | Path expression; reads from the current context                    |
| `"text"` or `'text'`    | String literal                                                     |
| `42`, `3.14`, `-1`      | Number literal                                                     |
| `true`, `false`, `null` | Literal value                                                      |
| `$varname`              | User-assigned variable (see [Variables](/docs/language/variables)) |
| `(otherHelper x)`       | Subexpression (see below)                                          |
| `key=value`             | Hash argument (see below)                                          |

## Nested expressions

Wrap a helper call in parentheses to use its result as an argument to another helper:

```hbs
Hello, {{default (capitalize name) 'stranger'}}!
```

<details>
<summary>Context and output</summary>

With context `{"name": "george"}` the output is `Hello, George!`.

With context `{}` the output is `Hello, stranger!`.

</details>

Subexpressions can nest arbitrarily deep: `{{outer (mid (inner x) y) z}}`.

## Hash arguments

After all positional arguments, a helper call may take **hash arguments** (`key=value` pairs). When present, Bigodin passes them as a single object — the **last** argument to the helper:

```hbs
{{link 'Sign up' target='_blank' rel='noopener'}}
```

```js
bigodin.addHelper('link', (label, options = {}) => {
  const attrs = Object.entries(options)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return `<a ${attrs}>${label}</a>`;
});
```

Rules:

- Positional arguments come first; hash arguments come last.
- Once a hash argument appears, no further positional argument is allowed.
- Duplicate keys are rejected at parse time.
- When no hash argument is present, no extra object is passed; the helper signature is unchanged.
- Values may be literals, paths, variables, or subexpressions, exactly like positional arguments.

## Path versus parameterless helper

A bare name with no arguments is ambiguous: it could be a path lookup or a no-arg helper call. Bigodin resolves this by checking the helper registry: if a helper with that name is registered, it runs; otherwise the name is treated as a path.

To force a path lookup when a helper with the same name is registered, prefix with `$this.`:

```hbs
{{uuid}}
{{! calls uuid() if registered, else reads "uuid" from context }}
{{$this.uuid}}
{{! always reads "uuid" from the current context }}
```

## Block helpers

Helpers can also be invoked as **blocks** with `{{#name args}}...{{/name}}`. The same calling syntax applies; what changes is what the helper does with the body. See [Conditional blocks](/docs/language/conditional-blocks), [Loop blocks](/docs/language/loop-blocks), [Context blocks](/docs/language/context-blocks), and the [Block helpers reference](/docs/helpers).
