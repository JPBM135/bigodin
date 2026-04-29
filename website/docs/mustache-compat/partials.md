---
title: 'Partials `{{>name}}`'
sidebar_position: 5
---

**Status: Not supported. Not currently planned; may be reconsidered if there is concrete demand.**

## Summary

A Mustache partial expands an inline reference to another named template into the current template at parse/render time. The partial can be recursive, can carry the current context, and (when standalone) re-applies its caller's indentation to every line of its rendered body.

Bigodin has no concept of partials. Templates that use `{{>name}}` fail to parse: the `>` after `{{` is not a recognized sigil, so the parser falls into the `default` branch and tries to parse `>name` as an expression, which fails with `Expected literal, helper or context path`.

`partials.json` is in `SKIPPED_SPECS` (`test/spec.spec.ts`); its 12 tests count toward the file-level skip total in the [overview](/docs/mustache-compat).

## Why not implemented

Partials are the most-requested missing feature for Mustache parity, but they are non-trivial to add safely:

- A new AST statement type, version bump (`VERSION` and `MAX_VERSION`), and runner case.
- A registry surface on the public API (presumably `addPartial(name, source)` paralleling `addHelper`) plus an option for caller-supplied registries on `RunOptions`.
- Recursion guarding via a depth counter on `Execution` (the existing `maxExecutionMillis` covers infinite recursion, but call-stack blow-up needs its own bound).
- Indentation reapplication: when a partial tag is on a standalone line, the caller's leading whitespace must be re-applied to every line of the partial's rendered output.
- Security: a user-controlled partial name could leak templates the caller didn't intend to expose, so the registry contract has to be explicitly an allowlist.

None of this is fundamentally hard, but it is a meaningful design surface for a feature that has not (yet) been requested by Bigodin's primary consumers. Open an issue if you have a concrete use case.

## Workaround

If you need template composition today, you have two options:

- **Compose at the data layer.** Pre-render fragments and pass them as strings; emit them with a raw helper if HTML is needed.
- **Use a helper.** Register a helper that returns a pre-rendered string for a named fragment. This does not give you the standalone-line indentation reapplication that real partials provide, but it covers the common "shared header / footer" case.

If partials are added in the future, this doc will be rewritten to describe the implementation. The known sequencing requirement is that [standalone-line-whitespace](/docs/mustache-compat/standalone-line-whitespace) is a prerequisite (already done), since several partial tests depend on it.
