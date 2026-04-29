---
title: 'Set Delimiters `{{=<% %>=}}`'
sidebar_position: 7
---

**Status: Not supported. Not planned: most defensible "won't fix" of the optional categories.**

## Summary

Mustache lets a template change the open/close delimiters mid-stream: `{{=<% %>=}}` switches from `{{ }}` to `<% %>` for the rest of the template (or until the next set-delimiter tag). Bigodin's parser hard-codes `{{` / `}}` and provides no mechanism to switch.

`delimiters.json` is in `SKIPPED_SPECS` (`test/spec.spec.ts`); its 14 tests count toward the file-level skip total in the [overview](/docs/mustache-compat). Bigodin's existing `{{=  ...}}` syntax is **variable assignment** (e.g. `{{= $foo expression}}`), not set-delimiters; the two share a leading `=` and would need to be disambiguated if set-delimiter support were added.

## Why not planned

Three reasons stack:

- **Real-world demand is minimal.** Handlebars itself does not ship set-delimiters, and Bigodin is positioned as a Handlebars-flavored superset.
- **The parser is combinator-based.** `pierrejs` parsers are pure functions; there is no built-in mutable parser state. Implementing delimiter switching cleanly requires either a preprocessing pass that rewrites the source (with a location-map so error messages still point at the right column) or threading delimiter state through `Pr.context` and rewriting `openMustache` / `closeMustache` / `text`. Both options are large surgeries on a stable parser.
- **Disambiguation cost.** The `=` branch in the parser today is assignment. Adding a set-delimiter meaning means context-sensitive parsing (e.g. `{{=` followed by `$` is assignment; `{{=` followed by anything else is a set-delimiter). Easy to get subtly wrong.

The combination - low demand, high implementation cost, and a brittle disambiguation - makes this the strongest "won't fix" candidate of the optional categories.

## Workaround

Pick a different templating tool if you need this feature; Bigodin will not be it. If you only want to escape literal `{{` / `}}` inside a template, the standard approach is to wrap the literal text in a helper or in a configured raw escape sequence rather than to repurpose the delimiter syntax.
