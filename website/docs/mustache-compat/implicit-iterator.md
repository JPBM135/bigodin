---
title: 'Implicit Iterator `{{.}}`'
sidebar_position: 2
---

**Status: Supported as an alias of `{{$this}}`.**

## Summary

In Mustache, `{{.}}` resolves to the _current context_, which is most useful when iterating over a list of scalars. Bigodin parses a bare `.` as sugar for its existing `$this` magic name, so the runtime path resolver handles it without any new code path.

```handlebars
{{#items}}{{.}}{{/items}}     {{!-- over ["a", "b", "c"] => "abc" --}}
{{#items}}{{$this}}{{/items}}  {{!-- equivalent --}}
```

Dotted access from the current context (`{{.foo.bar}}`) also works because it parses the same way as `{{$this.foo.bar}}`.

## Spec coverage

The `Implicit Iterators - Basic Interpolation`, `Implicit Iterator - Array`, `Implicit Iterators - Basic Integer Interpolation`, and the `Triple Mustache` / `Ampersand` variants in `interpolation.json` and `sections.json` all pass.

## Edge cases that remain skipped

The Mustache spec also exercises `{{.}}` over **truthy scalars** in section heads:

```handlebars
{{#scalar}}{{.}}{{/scalar}}    over scalar: "value"   => "value"
```

Bigodin's `runBlock` does **not** push truthy scalars onto the context stack (Handlebars-style: only objects and arrays push), so `{{.}}` inside such a section resolves to whatever was on top of the stack before the block opened, not to the scalar. This is a deliberate divergence; the affected tests (e.g. `Implicit Iterator - String`, `Implicit Iterator - Integer`, `Implicit Iterator - Decimal`, `Implicit Iterator - Root-level`) currently still pass for the strings the spec compares against because Bigodin emits whatever the parent context renders to, which happens to match. See [section-falsy-and-context.md](/docs/mustache-compat/section-falsy-and-context) for the full context-push rules.

The `Implicit Iterators - HTML Escaping` and `Implicit Iterator - HTML Escaping` cases are skipped at the runner level (Bigodin emits raw output by default).
