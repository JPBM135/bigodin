---
title: 'Section Context & Falsy Edge Cases'
sidebar_position: 6
---

**Status: Mostly supported, with two documented divergences from the spec.**

## Summary

Bigodin's runtime semantics for `{{#x}}...{{/x}}` and `{{^x}}...{{/x}}` match the Mustache spec for the common cases:

- `null`, `undefined`, `false`, `0`, `""`, and empty arrays are falsy on both the positive and inverted branches.
- Non-empty arrays iterate, pushing each item onto the context stack.
- Object values push as the new context.
- Truthy scalars (strings, numbers, `true`) render the body once.

The `Falsey`, `Truthy`, `Null is falsey`, `Context`, `Empty List`, `List`, `Doubled`, and similar tests in `sections.json` and `inverted.json` all pass.

## Documented divergences

The following spec tests are deliberately skipped (`SKIPPED_FEATURES` in `test/spec.spec.ts`):

- `Parent contexts`
- `List Contexts`
- `Deeply Nested Contexts`
- `Variable test`

All four require **automatic context-stack walk** on a missing key: when a name isn't found in the current frame, Mustache walks up the stack to find it. Bigodin uses Handlebars-style strict scoping; you must walk explicitly with `$parent` and `$root`:

```handlebars
{{#post}}{{$parent.author.name}}{{/post}}
```

A second divergence (not currently exercised by an active spec test, but worth flagging) is **truthy-scalar context push**:

```handlebars
{{#name}}Hello, {{.}}{{/name}}     name: "Alice"
```

In Mustache, the section pushes `"Alice"` onto the context stack so `{{.}}` resolves to it. In Bigodin, truthy scalars render the body but do **not** push: `{{.}}` resolves to whatever was on top of the stack before the section opened. This matches Handlebars' "use `{{#if}}` for truthiness, `{{#each}}` for iteration" idiom.

## Why the divergence

Both rules trade a small amount of spec conformance for clearer scoping rules:

- Strict scoping (no auto-walk) makes it impossible for a deeply-nested template to accidentally pick up a name from an outer frame, which is a common source of bugs in Handlebars-style templates that grow over time.
- Not pushing scalars keeps the context stack "shape-stable" - the top frame is always an object or an array element, never an opaque scalar - which simplifies reasoning about `{{$parent}}` and `{{$root}}`.

If your templates require Mustache's auto-walk behavior, prefer using explicit `$parent.foo` / `$root.foo` paths or restructure the data so the relevant key lives in the current frame.

## Implementation note

The relevant runtime is `src/runner/block.ts` `runBlock`. The negated branch and the empty-array guard share the same falsy check, so `{{^list}}...{{/list}}` over `list: []` correctly renders the body. Path resolution lives in `src/runner/path-expression.ts`; it does **not** walk up the context stack on a miss - `$parent`, `$root`, and `$this` are the explicit walkers.
