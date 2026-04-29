---
title: 'Variables'
slug: '/language/variables'
sidebar_position: 10
---

A **template variable** stores a value that can be reused later in the same render. Variables are prefixed with `$` and assigned with the `=` mustache:

```hbs
{{= $name "John"}}
Hello, {{ $name }}!
```

<details>
<summary>Context and output</summary>

### Context

```json
{}
```

### Generated output

```
Hello, John!
```

</details>

The assignment mustache produces no output of its own. It is "standalone" in the [comment](/docs/language/comments#standalone-lines) sense — when alone on a line, the line is removed.

## Assignment forms

The right-hand side of `{{= $name <value>}}` can be any expression that is also valid as a helper argument:

| Form        | Example                                                    |
| ----------- | ---------------------------------------------------------- |
| Literal     | `{{= $count 5}}`, `{{= $greeting "hi"}}`, `{{= $on true}}` |
| Path        | `{{= $userName user.name}}`                                |
| Variable    | `{{= $copy $original}}`                                    |
| Helper call | `{{= $upper (uppercase name)}}`                            |

Examples:

```hbs
{{= $userName user.name}}
Hello, {{ $userName }}!
```

<details>
<summary>Context and output</summary>

### Context

```json
{
  "user": {
    "name": "Alice"
  }
}
```

### Generated output

```
Hello, Alice!
```

</details>

```hbs
{{= $upperName (uppercase name)}}
Welcome, {{ $upperName }}!
```

<details>
<summary>Context and output</summary>

(With an `uppercase` helper registered.)

### Context

```json
{
  "name": "john"
}
```

### Generated output

```
Welcome, JOHN!
```

</details>

## Reassignment

A variable can be reassigned. The new value replaces the old one immediately; subsequent reads see the new value:

```hbs
{{= $x 1}}
{{= $y 2}}
{{= $sum (add $x $y)}}
{{= $result (multiply $sum 10)}}
Result: {{ $result }}
```

<details>
<summary>Context and output</summary>

### Context

```json
{}
```

### Generated output

```
Result: 30
```

</details>

## Scoping: variables are global

Unlike block-pushed context, variables are **not** scoped to the block they were assigned in. An assignment inside a block is visible after the block closes, in sibling blocks, and in parent blocks:

```hbs
{{= $var "global"}}
{{#condition}}
    {{= $var "block"}}
{{/condition}}
Outside: {{ $var }}
```

<details>

### Context

```json
{
  "condition": true
}
```

### Generated output

```
Outside: "block"
```

</details>

This is intentional — variables are how you accumulate state across iterations. The classic use is a running total in a loop:

```hbs
{{= $sum 0}}
{{#numbers}}
    {{= $sum (add $sum $this)}}
{{/numbers}}
Total: {{ $sum }}
```

<details>
<summary>Context and output</summary>

### Context

```json
{
  "numbers": [1, 2, 3, 4, 5]
}
```

### Generated output

```
Total: 15
```

</details>

If you need block-local state, use a fresh variable name per block.

## Undefined reads

Reading a variable that was never assigned does **not** error; it resolves to `undefined` and renders as the empty string:

```hbs
Value: "{{$undefined}}"
```

<details>
<summary>Context and output</summary>

### Context

```json
{}
```

### Generated output

```
Value: ""
```

</details>

## Variables versus context

Variables and context fields live in different namespaces. `{{name}}` reads from the context; `{{$name}}` reads from the variable map. A variable assignment never modifies the context, and a context value is never visible as a variable. Use whichever is appropriate; if you find yourself mirroring context into variables, you probably want to read from context directly.
