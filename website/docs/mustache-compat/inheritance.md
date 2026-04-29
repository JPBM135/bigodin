---
title: 'Inheritance `{{<parent}}{{$block}}...{{/parent}}` (optional)'
sidebar_position: 3
---

**Status: Not supported. Not planned: the `$` sigil collides with Bigodin's existing variable syntax.**

## Summary

An _optional_ Mustache feature (the `~inheritance.json` filename is prefixed with `~`) that adds template inheritance:

- `{{<parent}}...{{/parent}}` invokes `parent` as a layout, with overrides inside.
- `{{$blockName}}default{{/blockName}}` declares a named block in the parent, or overrides one when nested under `{{<parent}}`.
- The parent template is rendered with each block's content replaced by any override the caller supplied; otherwise the block's default is used.

Bigodin has neither parents nor named blocks. `~inheritance.json` is in `SKIPPED_SPECS` (`test/spec.spec.ts`); its 27 tests count toward the file-level skip total in the [overview](/docs/mustache-compat).

## Why not planned

Two distinct parse problems would need solving:

- `{{<parent}}` - the `<` after `{{` is not a recognized sigil today; falls into `$expression` which fails.
- `{{$block}}` - Bigodin already uses `$` for variables (`{{$this}}`, `{{$parent}}`, `{{$root}}`, `{{= $foo expr}}`). The parser interprets `{{$block}}` as a variable reference, then the matching `{{/block}}` is encountered without an open block and fails.

The `$` collision is the awkward part, and resolving it cleanly requires context-sensitive parsing (e.g. only treat `{{$name}}` as a block declaration when inside a `{{<parent}}` body, leaving the variable meaning intact elsewhere). That is workable but adds parser state and risks subtle backward-compatibility surprises.

On top of the parser work, inheritance shares partials' need for a registry, recursion guarding, and indentation reapplication. Inheritance is also the _largest_ optional category by test count and most heavyweight by implementation cost.

For Bigodin's current consumer base (Handlebars-flavored templates, mock generation, JSON / text output), template inheritance has not surfaced as a real need. This category is the strongest "won't fix" candidate in the directory, alongside set-delimiters.

## Workaround

If you need layout-style composition, the typical Handlebars approach is to compose the layout with helpers and slot data into the layout's context, rather than to invert control via inheritance. A registered helper that takes an inner-content string parameter approximates the most common "named block" use case without changing parser semantics.
