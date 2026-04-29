---
title: 'Render HTML safely'
sidebar_position: 1
---

**Problem.** You are rendering Bigodin output into an HTML document, possibly with user-controlled context values, and you need to escape `<`, `>`, `&`, `"`, and `'` to prevent injection.

**Why this needs a recipe.** Bigodin emits raw output by default. `{{x}}`, `{{{x}}}`, and `{{&x}}` are all identical. The triple-mustache and ampersand forms exist for syntactic compatibility with Mustache; they are **not** an "opt out of escaping" toggle, because there is nothing to opt out of.

If you are rendering for HTML, you are responsible for escaping.

## Recipe: a per-value `escape` helper

Register an escape helper and call it explicitly at every interpolation site that emits user data into HTML.

```javascript
import Bigodin from '@jpbm135/bigodin';

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const bigodin = new Bigodin();
bigodin.addHelper('e', (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch]),
);

const template = bigodin.compile('<p>Hello, {{e name}}!</p><p>Bio: {{e bio}}</p>');

await template({
  name: '<script>alert(1)</script>',
  bio: 'Likes "templates" & coffee',
});
// <p>Hello, &lt;script&gt;alert(1)&lt;/script&gt;!</p>
// <p>Bio: Likes &quot;templates&quot; &amp; coffee</p>
```

The short helper name (`e`) is a deliberate ergonomics choice: every interpolation is going to call it, so the noise budget should be tight.

## Recipe: escape the entire output

If your template emits HTML and you do not want to remember to call `e` everywhere, escape the rendered string after the fact, **but only for values you know are not pre-escaped**. This pattern works when the entire context is untrusted and the template itself contains only literal HTML structure:

```javascript
const result = await template(untrustedContext);
res.send(escape(result));
```

This is brittle: any literal HTML in the template (`<p>`, `<a href="...">`) gets double-escaped. Per-value escaping with `{{e ...}}` is what we recommend.

## Recipe: pre-mark a helper output as "already safe"

When a helper deliberately returns HTML (for example a markdown-to-HTML converter), that output should pass through escaping unchanged. A common pattern is a marker class:

```javascript
class SafeString {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

bigodin.addHelper('e', (value) => {
  if (value instanceof SafeString) return value.value;
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch]);
});

bigodin.addHelper('markdown', (md) => new SafeString(renderMarkdown(md)));
```

Now `{{e (markdown body)}}` calls `markdown` to render HTML, and `e` recognizes the marker and skips escaping.

## What about `{{{x}}}` and `{{&x}}`?

These produce **identical output to `{{x}}`** in Bigodin. They exist for syntactic compatibility with Mustache templates that use them, not as an escape opt-out. If a Mustache template you are porting uses `{{{x}}}` to mean "render this literal HTML," that intent must be reproduced explicitly with a `SafeString`-style helper or trusted concatenation.

## Related

- [Migrating from Mustache](/docs/how-to/migrate-from-mustache) for the full list of where Mustache and Bigodin differ
- [Triple mustache and ampersand](/docs/mustache-compat/triple-mustache-and-ampersand) for the spec compatibility detail
