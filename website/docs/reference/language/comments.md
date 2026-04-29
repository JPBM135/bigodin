---
title: 'Comments'
slug: '/language/comments'
sidebar_position: 2
---

A comment is delimited by `{{!` and `}}`. The contents are not rendered; the comment itself may be removed from the output entirely (see "standalone lines" below).

```hbs
{{! greeting the user }}
Hello,
{{name}}
:)
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
Hello, George :)
```

</details>

## What can go inside

Anything except the closing `}}`. Comments can span multiple lines:

```hbs
{{!
    This template renders the homepage.
    Touch the team in #frontend before changing it.
}}
```

There is no nested-comment syntax. A `{{` inside a comment is text and does not start a new tag.

## Standalone lines

When a comment (or a section open / close tag) is the **only** non-whitespace content on its line, the entire line is removed from the output, including the trailing newline and any leading indentation. This matches Mustache's "standalone line" rule and lets you indent template structure for readability without producing extra blank lines.

```hbs
List:
{{! header }}
- item 1 - item 2
```

renders as:

```
List:
- item 1
- item 2
```

…not:

```
List:

- item 1
- item 2
```

Variable interpolation tags (`{{x}}`, `{{{x}}}`, `{{&x}}`) are **not** standalone-eligible; they always render in place and never consume their own line.

## When to use comments versus `{{!--}}`

There is no `{{!--}}` form in Bigodin. The single `{{! ... }}` comment is the only comment syntax.
