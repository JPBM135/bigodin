---
title: 'Migrate from Mustache'
sidebar_position: 5
---

**Problem.** You have templates written for Mustache (or Handlebars) and want to render them with Bigodin.

**The short answer.** Most templates work as-is. Bigodin passes 103 of 110 attempted Mustache spec tests. The deltas are: no HTML escaping by default, no auto context-stack walk, no partials, no set-delimiters, no inheritance, no dynamic names, no lambdas. Use `addHelper` instead of lambdas; everything else is documented below.

## Compatibility at a glance

| Mustache feature                        | Works in Bigodin?               | Action                                                                       |
| --------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| `{{x}}` interpolation                   | Yes, but **never HTML-escapes** | Add an `e` helper, see [Render HTML safely](/docs/how-to/render-html-safely) |
| `{{{x}}}`, `{{&x}}`                     | Yes, identical to `{{x}}`       | None; remove if you prefer the canonical form                                |
| `{{#x}}...{{/x}}` sections              | Yes                             | None; truthy non-objects do not push context (Handlebars-style)              |
| `{{^x}}...{{/x}}` inverted              | Yes                             | None                                                                         |
| `{{! ... }}` comments                   | Yes                             | None                                                                         |
| `{{.}}` implicit iterator               | Yes (alias of `{{$this}}`)      | None                                                                         |
| `{{> name }}` partials                  | **No**                          | Inline the partial, or render in two passes from your code                   |
| `{{= <% %> =}}` set delimiters          | **No**                          | Pre-process the template before `parse`                                      |
| `{{< parent }}{{$ block }}` inheritance | **No**                          | Compose templates in your code                                               |
| `{{*name}}` dynamic names               | **No**                          | Use a helper to look up the value                                            |
| Lambdas (functions in context)          | **No**                          | Convert to a helper with `addHelper`                                         |
| Auto context-stack walk                 | **No**                          | Use `$parent` or `$root` explicitly                                          |

The full per-feature breakdown lives in [Mustache spec compatibility](/docs/mustache-compat).

## Behavior change: no HTML escaping

In Mustache, `{{x}}` HTML-escapes and `{{{x}}}` emits raw. In Bigodin, **both emit raw**. If your template renders to HTML, you must escape every interpolation explicitly with a helper. See [Render HTML safely](/docs/how-to/render-html-safely) for the recipe.

A common migration shape:

```diff
- <p>Hello, {{name}}!</p>
+ <p>Hello, {{e name}}!</p>
```

…with `e` registered as the escape helper.

## Behavior change: no auto context-stack walk

Mustache resolves a missing key by walking up the context stack. Bigodin uses Handlebars-style strict scoping: a missing key is `undefined`. Use `$parent` (one level up), `$root` (the outermost context), or `$this` (the current context) to walk explicitly:

```handlebars
{{#each items}}
  {{name}}
  on team
  {{$parent.team}}
{{/each}}
```

If you have a Mustache template that relies on the walk, the most mechanical port is to add the `$parent` chain wherever the walk would have happened. Templates rarely use the walk in places where it is _not_ obvious, so this is usually a small change.

## Behavior change: no lambdas

Mustache lets you place a function in the rendering context. Bigodin does not invoke functions in context; they fall through as `[object Function]` (or are coerced to string). The supported substitute is a helper:

```diff
- // context: { uppercase: (text) => text.toUpperCase() }
- {{#uppercase}}{{name}}{{/uppercase}}

+ // const bigodin = new Bigodin();
+ // bigodin.addHelper('uppercase', (s) => String(s).toUpperCase());
+ {{uppercase name}}
```

The helper API is the deliberate, safer alternative; it cannot re-enter the parser, cannot capture the template source, and runs in the same sandbox as everything else.

## Behavior change: no partials, set-delimiters, inheritance

These are not on the roadmap. The rationale for each is in [Mustache spec compatibility](/docs/mustache-compat); short version:

- **Partials**: render in two passes from your code (parse the partial separately, run it, splice the result into the outer context as a string), or inline.
- **Set-delimiters**: pre-process the template source to swap delimiters before calling `parse`.
- **Inheritance**: compose templates in your code by rendering the child first into a context value the parent reads.

If your codebase leans heavily on partials or inheritance, Bigodin may not be the right fit; Handlebars itself supports both.

## Migration checklist

1. **Audit `{{{x}}}` and `{{&x}}` sites.** They emit raw output now, just like `{{x}}`. If you used them to bypass escaping, the bypass is no longer meaningful (nothing escapes); the security implication has flipped.
2. **Add an `e` helper** if rendering HTML, and call it on every interpolation that emits user data.
3. **Replace lambdas** in your context with `addHelper` calls on a `new Bigodin()` instance.
4. **Replace partials, set-delimiters, inheritance** with the patterns above.
5. **Walk the context stack explicitly** with `$parent` / `$root` wherever your Mustache template relied on the auto-walk.
6. **Run your template against a representative context** and diff against the Mustache output. Most templates produce identical output after steps 1 and 2.

## Related

- [Render HTML safely](/docs/how-to/render-html-safely)
- [Mustache spec compatibility](/docs/mustache-compat)
- [Why interpret, not compile](/docs/explanation/security-model)
