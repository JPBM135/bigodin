---
title: 'Dynamic Names `{{*name}}` (optional)'
sidebar_position: 1
---

**Status: Not supported. Depends on partials, which are also not implemented.**

## Summary

Dynamic Names is an _optional_ Mustache feature (the `~dynamic-names.json` filename is prefixed with `~`) that lets a partial's name come from a runtime variable rather than a literal: `{{>*foo}}` looks up `foo` in the current context and uses its string value as the partial name. Combined with dotted names (`{{>*foo.bar}}`), it enables registry-style template selection.

Bigodin does not implement partials (see [partials.md](/docs/mustache-compat/partials)), so dynamic names cannot work either. `~dynamic-names.json` is in `SKIPPED_SPECS` (`test/spec.spec.ts`); its 21 tests count toward the file-level skip total in the [overview](/docs/mustache-compat).

## Why not implemented

This category is entirely a layer on top of partials. If partials land in the future, dynamic names is a small follow-up: extend the partial-name parser to optionally accept a leading `*` and add a `dynamic: boolean` field to the partial AST node; at runtime, resolve the name as a path expression against the current context and proceed as for a static partial.

Until partials exist, there is nothing to extend. Open an issue if you have a concrete use case (the parent partials feature is the actual blocker).
