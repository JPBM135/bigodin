---
title: 'Triple Mustache `{{{x}}}` and Ampersand `{{&x}}`'
sidebar_position: 9
---

**Status: Supported as raw-emit aliases of `{{x}}`.**

## Summary

In Mustache, `{{x}}` HTML-escapes the value, while `{{{x}}}` and `{{&x}}` emit it raw. Bigodin does not HTML-escape by default; it treats every `{{x}}` as raw output. The triple-brace and ampersand forms are accepted by the parser purely for spec compatibility and behave identically to the standard `{{x}}` form.

```handlebars
{{x}}     => raw value
{{{x}}}   => raw value (same as {{x}})
{{&x}}    => raw value (same as {{x}})
```

All three forms accept the same right-hand side: paths, dotted access, helpers, literals, and variables.

## Spec coverage

All `Triple Mustache`, `Ampersand`, and dotted/integer/null/whitespace variants in `interpolation.json` and `sections.json` pass.

## What is _not_ supported: HTML escaping for `{{x}}`

The Mustache spec's `HTML Escaping` test expects `{{x}}` to escape `& < > " '`. Bigodin's headline behavior is "emit raw," so the three `HTML Escaping` variants are deliberately skipped (`SKIPPED_FEATURES` in `test/spec.spec.ts`). If you need escaping, register an escape helper and apply it explicitly:

```handlebars
{{escape user.bio}}
```

See [Render HTML safely](/docs/how-to/render-html-safely) for a worked example.

## Why this divergence

Bigodin is positioned as a Handlebars-flavored superset, and a lot of real templates are used to build non-HTML output (JSON, plain text, markdown). Defaulting to raw output keeps that path simple. The opt-in escape-helper approach also keeps the escape policy in one place that callers control, instead of baking a single HTML-escape table into the runtime.

## Parser implementation note

Both forms are dispatched in `src/parser/index.ts` `$template` based on the character immediately after `{{`:

- `&` consumes the `&` and parses the inner expression as a normal `MustacheStatement`.
- `{` consumes the second `{`, parses the inner expression, and then requires an extra closing `}` before the standard `}}`.

Neither form introduces a new AST shape; both produce `MustacheStatement`. No `VERSION` bump was needed for this feature.
