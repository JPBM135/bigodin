---
title: 'Standalone-Line Whitespace Stripping'
sidebar_position: 8
---

**Status: Supported for comments and section open / close tags.**

## Summary

Mustache defines a "standalone line" as any line whose only non-whitespace content is a single tag from a specific set. When a line is standalone, the entire line - leading whitespace, the tag, and the trailing newline - is consumed from the output. Variable interpolation tags (`{{x}}`, `{{{x}}}`, `{{&x}}`) are deliberately excluded.

Bigodin applies this rule to:

- Comments: `{{! ... }}`
- Section openers and closers: `{{#x}}`, `{{/x}}`, `{{^x}}`

Set-delimiter, partial, and inheritance tags are not implemented in Bigodin, so the rule does not apply to them.

```handlebars
Hello
  {{! a comment }}
World
```

renders as:

```text
Hello
World
```

The leading whitespace and trailing newline on the comment line are both consumed.

## Spec coverage

All standalone-line tests in `comments.json`, `sections.json`, and `inverted.json` pass:

- `Standalone`, `Indented Standalone`, `Standalone Line Endings`
- `Standalone Without Previous Line`, `Standalone Without Newline`
- `Multiline Standalone`, `Indented Multiline Standalone`
- `Standalone Lines`, `Indented Standalone Lines`, `Standalone Indented Lines`

The standalone-line tests in `delimiters.json` and `partials.json` are skipped at the file level because the host features (set-delimiters, partials) are not implemented; the whitespace rule itself is not the blocker.

## Implementation note

Standalone stripping is a post-parse pass over the AST in `src/parser/index.ts` (`stripStandaloneLines`). It walks each statement list (top-level and every block's `statements` / `elseStatements`), looks at the surrounding TEXT statements, and trims leading/trailing whitespace where the line qualifies as standalone. Block openers are checked against the parent list's previous TEXT plus the first TEXT inside the block; block closers are checked against the last TEXT inside the block plus the parent list's next TEXT.

No AST shape change is required for this feature; whitespace edits live inside existing `TextStatement.value`.
