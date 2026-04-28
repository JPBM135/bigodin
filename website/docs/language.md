---
title: "Template language"
sidebar_position: 3
# Auto-generated from LANGUAGE.md; edit the source file in the repo root.
---
Bigodin is a templating language that allows you to create **templates** that will generate an **output** when given a **context**. A context is a JSON-like object that can contain numbers, strings, booleans, arrays, objects.

You can access fields from the context in your template:

## Path expressions

Path expressions are mustaches (between `{{` and `}}`) that allow you to access fields from the context, here's an example:

```hbs
Hello, {{ name }}!
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

---

Path expressions can access nested objects with dot notation:

```hbs
Hey {{ name.first }} {{ name.last }}!
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

---

## Comments

Comments are written between `{{!` and `}}`:

```hbs
{{! greeting the user }}
Hello, {{ name }} :)
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

When a comment (or a section open/close tag) is the only non-whitespace content on its line, the entire line — including the trailing newline and any leading indentation — is removed from the output. This matches Mustache's "standalone line" rule and means template structure can be indented for readability without producing extra blank lines. Variable interpolation tags (`{{x}}`, `{{{x}}}`, `{{&x}}`) are not standalone-eligible and always render in place.

---

## Raw output

`{{x}}`, `{{{x}}}`, and `{{&x}}` all produce the same output in Bigodin — values are emitted as-is, never HTML-escaped. The triple-mustache and ampersand forms are accepted for compatibility with Mustache templates; if you need HTML escaping, register an `escape` helper and call `{{escape x}}` explicitly.

---

## Helpers

Helpers are functions that can be called from within your templates. Bigodin ships only the [block primitives](/docs/helpers) (`if`, `unless`, `with`, `each`, `return`); everything else you register yourself with `addHelper` (see [/docs/lib](/docs/lib#helpers)).

For example, after registering a `capitalize` helper:

```js
bigodin.addHelper('capitalize', s => String(s).charAt(0).toUpperCase() + String(s).slice(1));
```

```hbs
Hello, {{capitalize name }}!
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

Note that spaces are optional inside mustaches, `{{name}}` is the same as `{{ name }}`; `{{capitalize name }}` is the same as `{{ capitalize name }}` or `{{capitalize name}}`.

---

You can pass multiple arguments to helpers separated by spaces. With a `default` helper that returns the first non-null argument:

```hbs
Hello, {{default name "stranger"}}!
```

<details>
<summary>Context and output</summary>

With context `{"name": "George"}` the output would be:
```
Hello, George!
```

With context `{}` the output would be:
```
Hello, stranger!
```

</details>

---

Expressions can be nested with parentheses, you can pass the return of a helper as a parameter to another one:

```hbs
Hello, {{default (capitalize name) "stranger"}}!
```

<details>
<summary>Context and output</summary>

With context `{"name": "george"}` the output would be:
```
Hello, George!
```

With context `{}` the output would be:
```
Hello, stranger!
```

</details>

---

You can use `$this` to disambiguate between context path expressions and parameterless helper calls. Assuming a `uuid` helper is registered:

```hbs
{{! This runs the helper uuid and renders its response }}
{{ uuid }}

{{! This renders the `uuid` value from context }}
{{ $this.uuid }}
```

---

## Conditional Blocks

You can use blocks for conditionals. Blocks are written between `{{#` and `}}` and closed with `{{/` and `}}`, when given a truthy value they are executed, when given a falsy value they are ignored:

```hbs
{{#name}}
Hello, {{ name }}!
{{/name}}
Welcome to our website :)
```

<details>
<summary>Context and output</summary>

With context `{"name": "George"}` the output would be:
```
Hello, George!
Welcome to our website :)
```

With context `{}` or `{"name": null}` the output would be:
```
Welcome to our website :)
```

</details>

Note that, for blocks, you cannot have a space between the opening mustache and the `#`.

---

Blocks can have an else section, which is executed when the block is not truthy:

```hbs
{{#name}}
Hello, {{ name }}!
{{else}}
Hello, Stranger!
{{/name}}
```

<details>
<summary>Context and output</summary>

With context `{"name": "George"}` the output would be:
```
Hello, George!
```

With context `{}` or `{"name": null}` the output would be:
```
Hello, Stranger!
```

</details>

---

You can also use helpers in blocks. With a custom `eq` helper registered (`(a, b) => a === b`):

```hbs
{{#if (eq name "george")}}
Hello, George!
{{else}}
Hello, stranger!
{{/if}}
```

<details>
<summary>Context and output</summary>

With context `{"name": "george"}` the output would be:
```
Hello, George!
```

With context `{"name": "alice"}` the output would be:
```
Hello, stranger!
```

</details>

---

Else blocks can be nested with the next helper, instead of writing:

```hbs
{{#if (eq country 'BR')}}
    Brazil
{{else}}
    {{#if (eq country 'US')}}
        United States
    {{else}}
        Other
    {{/if}}
{{/if}}
```

You can write:

```hbs
{{#if (eq country 'BR')}}
    Brazil
{{else if (eq country 'US')}}
    United States
{{else}}
    Other
{{/if}}
```

If you nest multiple helpers, you always close the first helper only:
```hbs
{{#if (gt (length nickname) 16)}}
    Your nickname is too long :(
{{else if (eq (length nickname) 3)}}
    Your nickname is as long as "cat" :)
{{else}}
    "{{nickname}}" is {{length nickname}} chars long
{{/if}} {{! Closing the first helper (if), not "else if" }}
```

---

## Loop Blocks

You can also use blocks for loops. When given an array, the block will be executed for each element in the array. The context inside the block is changed to the item of the array:

```hbs
{{name}}, your comments:

{{#comments}}
    {{author}} wrote:
    {{comment}}
{{/comments}}
```

<details>
<summary>Context and output</summary>

### Context
```json
{
    "name": "George",
    "comments": [{
        "author": "Alice",
        "comment": "Nice presentation"
    }, {
        "author": "Bob",
        "comment": "Thanks for the feedbacks"
    }]
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

The blank lines that visually separate each iteration in the template come from standalone-line stripping: the `{{#comments}}` and `{{/comments}}` tags consume their own lines, while the empty line between the title and the first iteration is preserved verbatim.

---

You can use the current item of the loop with `$this` (or its short alias `.`):

```hbs
{{#keywords}}
- {{ $this }}
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

`{{.}}` is the Mustache-style implicit iterator and resolves to the current context. It is exactly equivalent to `{{$this}}`:

```hbs
{{#keywords}}- {{.}}
{{/keywords}}
```

---

## Iteration data variables

Inside a loop block, the following Handlebars-style `@`-data variables are available:

- `{{@index}}`: zero-based index of the current iteration (number).
- `{{@key}}`: same as `@index` for arrays (kept for Handlebars parity).
- `{{@first}}`: `true` on the first iteration, `false` otherwise.
- `{{@last}}`: `true` on the last iteration, `false` otherwise.

Outside of a loop, all of these resolve to `undefined`. When loops are nested, the inner iteration shadows the outer one. There is no `@../index` syntax for reaching the outer loop.

```hbs
{{#items}}{{#if @first}}[{{/if}}{{@index}}:{{$this}}{{#if @last}}]{{else}}, {{/if}}{{/items}}
```

With context `{ "items": ["a", "b", "c"] }` the output is `[0:a, 1:b, 2:c]`.

---

You can use `$parent` to point to the parent context (you can use multiple parents like `$parent.$parent.foo`) and `$root` to point to the main context.

For Handlebars compatibility, `../` is accepted as an alias for `$parent.`, `@root` is accepted as an alias for `$root`, and bare `this` is accepted as an alias for `$this`. The two forms are interchangeable: `{{../name}}` and `{{$parent.name}}` produce identical ASTs.

> **Note**: because `this` is now an alias, `{{this}}` and `{{this.foo}}` resolve to the current context (or its `foo` field), not to context keys literally named `"this"`. If your data has a key called `this`, access it through a parent path (`{{$parent.this}}` after a block push) or rename the field. Templates that did not use `this` as a property name are unaffected.

```hbs
{{name}}, your comments:

{{#comments}}
    From {{author}} to {{../name}}:
    {{comment}}
{{/comments}}
```

<details>
<summary>Context and output</summary>

### Context
```json
{
    "name": "George",
    "comments": [{
        "author": "Alice",
        "comment": "Nice presentation"
    }, {
        "author": "Bob",
        "comment": "Thanks for the feedbacks"
    }]
}
```

### Generated output
```
George, your comments:

    From Alice to George:
    Nice presentation
    From Bob to George:
    Thanks for the feedbacks
```

</details>

---

## Negated blocks

You can use negated blocks for conditionals only. Replace `#` by `^` like so:

```hbs
{{^name}}
You are not logged in
{{/name}}
```

Inverted blocks are also rendered when the value is an empty array — `{{^items}}…{{/items}}` over `{ "items": [] }` runs the body, matching the Mustache rule that empty lists are falsy.

---

Inside `{{# … }}` and `{{/ … }}`, the names `null`, `true`, `false`, and `undefined` are treated as **context keys**, not as the literal value of the same name. So `{{#null}}…{{/null}}` looks up the key `"null"` in the current context (this matters for templates ported from Mustache that use such names as data keys). Use the `if` helper with a literal value if you need conditional logic against the actual values.

---

## Context Blocks

When given an object, a block will be rendered with it as the context:

```hbs
{{#parent}}
Hello, {{ name }}!
{{/parent}}
```

<details>
<summary>Context and output</summary>

### Context
```json
{
    "name": "George",
    "parent": {
        "name": "Alice"
    }
}
```

### Generated output
```
Hello, Alice!
```

</details>

---

You can use the `if` helper to prevent that from happening:

```hbs
{{#if parent}}
Hello, {{ name }}!
{{/if}}
```

<details>
<summary>Context and output</summary>

### Context
```json
{
    "name": "George",
    "parent": {
        "name": "Alice"
    }
}
```

### Generated output
```
Hello, George!
```

</details>

---

You can use the `with` helper to force an item as context even if it's not an object:

```hbs
{{#with parent}}
Hello, {{ $this }}!
{{/with}}
```
<details>
<summary>Context and output</summary>

### Context
```json
{
    "name": "George",
    "parent": 5
}
```

### Generated output
```
Hello, 5!
```

</details>

---

## Variables

Variables allow you to store and reuse values within your templates. Variables are prefixed with `$` and can be assigned using the `=` operator:

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

---

Variables can be assigned from context data:

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

---

Variables can be assigned from helper results. With an `uppercase` helper registered (`s => String(s).toUpperCase()`):

```hbs
{{= $upperName (uppercase name)}}
Welcome, {{ $upperName }}!
```

<details>
<summary>Context and output</summary>

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

---

Variables can be reassigned and used in complex expressions. With `add` and `multiply` helpers registered:

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

---

Variables have global scoping - variables assigned inside blocks are available within that block, in sibling blocks, and in parent blocks:

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

---

Variables can be used in loops and maintain state across iterations (still using a custom `add` helper):

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

---

Undefined variables do not error and return empty strings:

```hbs
Value: "{{ $undefined }}"
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
