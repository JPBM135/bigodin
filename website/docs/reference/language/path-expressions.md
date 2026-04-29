---
title: 'Path expressions'
slug: '/language/path-expressions'
sidebar_position: 1
---

A **path expression** is a mustache (between `{{` and `}}`) that reads a value out of the rendering context. The simplest form names a top-level key:

```hbs
Hello, {{name}}!
```

<details>
<summary>Context and output</summary>

### Context

```json
{
  "name": "George"
}
```

### Generated output

```
Hello, George!
```

</details>

Spaces inside the braces are optional and never significant: `{{name}}`, `{{ name }}`, and `{{  name  }}` all parse identically.

## Dot notation

Nested fields are reached with dot notation. There is no special operator for arrays; numeric segments are supported by helpers, not by the path syntax itself:

```hbs
Hey {{name.first}} {{name.last}}!
```

<details>
<summary>Context and output</summary>

### Context

```json
{
  "name": {
    "first": "George",
    "last": "Smith"
  }
}
```

### Generated output

```
Hey George Smith!
```

</details>

## Missing keys

A missing key resolves to `undefined` and renders as the empty string. Bigodin does **not** walk the context stack the way Mustache does; if a name is not found in the current context, the lookup stops there. Use the [context-walking variables](/docs/language/context-blocks) (`$parent`, `$root`) to reach outer scopes explicitly.

```hbs
[{{missing}}]
```

…with any context renders as `[]`.

## Special names

These bare-word names have built-in meanings inside path expressions; see the linked pages for details.

| Name                                | Meaning                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `$this`, `this`, `.`                | Current context (see [Context blocks](/docs/language/context-blocks))              |
| `$parent`, `../`                    | One level up the context stack                                                     |
| `$root`, `@root`                    | Outermost context                                                                  |
| `$<name>`                           | A user-assigned variable (see [Variables](/docs/language/variables))               |
| `@index`, `@key`, `@first`, `@last` | Inside a loop only (see [Iteration variables](/docs/language/iteration-variables)) |

## Path versus helper call

A bare identifier with no parameters is ambiguous between a path lookup and a no-arg helper call. Bigodin resolves this by checking the helper registry: if a helper with that name is registered (custom or built-in), the helper runs; otherwise the name is treated as a path. To force a path lookup when a helper of the same name exists, prefix with `$this.`:

```hbs
{{uuid}}
{{! calls the uuid helper if registered, else looks up "uuid" in context }}
{{$this.uuid}}
{{! always reads the "uuid" key from the current context }}
```

See [Calling helpers](/docs/language/helpers) for the full helper-call syntax.
