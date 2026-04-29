---
title: 'Bound execution time'
sidebar_position: 3
---

**Problem.** You are rendering templates submitted by end users. A buggy or hostile template can spin in a helper, recurse pathologically, or allocate enough output to be a denial-of-service vector. You need a hard ceiling on render time and a way to stop early on business conditions.

**Three knobs, three audiences.**

| Knob                 | Who controls it      | When to use                                                                   |
| -------------------- | -------------------- | ----------------------------------------------------------------------------- |
| `maxExecutionMillis` | The host application | Hard wall-clock budget on hostile or untrusted input                          |
| `this.halt()`        | A custom helper      | Programmatic early exit on a business condition (e.g. "user is rate-limited") |
| `{{return}}`         | The template author  | Cooperative early exit baked into the template                                |

You typically combine them: `maxExecutionMillis` as the outer fence, helpers and `{{return}}` for in-band control flow.

## Recipe: hard wall-clock budget

Pass `maxExecutionMillis` in `RunOptions`. The runner checks it at the top of every statement; once exceeded, the run rejects:

```javascript
import Bigodin from '@jpbm135/bigodin';

const bigodin = new Bigodin();
bigodin.addHelper('slow', async () => {
  await new Promise((r) => setTimeout(r, 200));
  return 'done';
});

const template = bigodin.compile('Result: {{slow}}');

try {
  await template({}, { maxExecutionMillis: 50 });
} catch (err) {
  console.error(err.message); // execution exceeded 50ms
}
```

The check sits between statements, so a single helper that takes longer than the budget will still complete (the budget catches the _next_ statement). For real isolation against runaway helpers, also wrap the whole render in a `Promise.race` with a timeout, or run the render in a worker.

## Recipe: programmatic early exit from a helper

Inside a helper, `this.halt()` stops the run. Whatever has been emitted so far is returned as the rendered string:

```javascript
bigodin.addHelper('requireAuth', function () {
  if (!this.data?.user) {
    this.halt();
    return '';
  }
  return '';
});

const template = bigodin.compile('{{requireAuth}}Hello, {{name}}! Your private content here.');

const result = await template({ name: 'George' }, { data: {} });
// "" — halted before the greeting was emitted
```

`halt()` does not throw. The promise resolves normally with the partial output.

Common pattern: a helper that walks a list and stops on a sentinel. Pair it with `{{each}}`:

```javascript
bigodin.addHelper('stopIfBlocked', function (item) {
  if (item.blocked) this.halt();
  return '';
});
```

```handlebars
{{#each items}}
  {{stopIfBlocked $this}}-
  {{name}}
{{/each}}
```

## Recipe: cooperative early exit from the template

The `{{return}}` block is the template-author-facing version of `halt()`:

```javascript
const template = bigodin.compile('Hello{{#if shouldStop}}{{return}}{{/if}}, world!');

console.log(await template({ shouldStop: true })); // "Hello"
console.log(await template({ shouldStop: false })); // "Hello, world!"
```

`{{return}}` is unconditional inside its own statement, so wrap it in `{{#if}}` (or any block helper) to make it conditional.

## What the budget does _not_ protect against

- **A helper that hangs forever inside a single statement.** The budget is checked between statements. Wrap suspect helpers in their own timeout, or run untrusted helpers off-thread.
- **Output size.** Bigodin does not cap the rendered string length. If your concern is memory, count or truncate output yourself.
- **Synchronous helpers that block the event loop.** `maxExecutionMillis` is wall-clock; a CPU-bound JS function still pegs the loop. Push CPU work into workers or native code.

## Related

- [Library API](/docs/lib#runoptions) for the full `RunOptions` shape
- [Block helpers reference](/docs/helpers#return) for `{{return}}`
- [Why interpret, not compile](/docs/explanation/security-model) for the broader threat model
