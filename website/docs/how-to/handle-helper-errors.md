---
title: 'Handle helper errors without failing the render'
sidebar_position: 5
---

**Problem.** A helper can fail: an HTTP call times out, a record is missing, an input is invalid. If the helper throws, the whole render rejects and the user gets nothing. You want the rest of the template to render, and you want the template to decide what to show in place of the failed value.

**Why this works.** Bigodin exports a well-known symbol, `errorTag`, that marks an object as an error, the same way `Symbol.iterator` marks an object as iterable. A helper that returns a tagged object does not stop the render. Instead, the value is:

- **falsy** in every block and built-in helper, so `{{else}}` branches run;
- **rendered as an empty string** if it is output directly;
- **passed unchanged** to other helpers, which can detect it with `isError`.

See [Error returns](/docs/lib#error-returns) for the exact rules.

## Recipe: tag a failure

Any object can carry the tag. Set `errorTag` to a truthy value and put whatever details you need next to it:

```javascript
import Bigodin, { errorTag } from '@jpbm135/bigodin';

const bigodin = new Bigodin();

bigodin.addHelper('user', async (id) => {
  const res = await fetch(`https://api.example.com/users/${id}`);
  if (!res.ok) {
    return { [errorTag]: true, message: `user lookup failed: ${res.status}` };
  }

  return res.json();
});
```

If your helpers share an error type, put the tag on the prototype once. Inherited tags count:

```javascript
class HelperError extends Error {
  get [errorTag]() {
    return true;
  }
}

bigodin.addHelper('user', async (id) => {
  try {
    return await api.getUser(id);
  } catch (error) {
    return new HelperError(error.message);
  }
});
```

To stop treating an object as an error, set the tag to a falsy value: `{ [errorTag]: false }` is not an error.

## Recipe: branch in the template

Because a tagged value is falsy, any block with an `{{else}}` branch doubles as an error handler:

```handlebars
{{#with (user id)}}
  Hi
  {{name}}!
{{else}}
  We could not load your profile.
{{/with}}
```

`#if`, `#unless`, `#each`, negated blocks (`{{^...}}`), and your own block helpers behave the same way. A tagged array is falsy too, so `#each` over it runs `{{else}}` instead of looping.

If you need the result more than once, store it in a variable so the helper runs a single time:

```handlebars
{{= $user (user id)}}
{{#with $user}}Hi {{name}}!{{else}}Profile unavailable.{{/with}}
{{#if $user}}<a href="/settings">Settings</a>{{/if}}
```

## Recipe: a fallback helper

Templates cannot read the error details: a tagged value renders as an empty string, and the tag itself is a symbol, which paths cannot reach. Use `isError` in a helper to turn an error into output:

```javascript
import { isError } from '@jpbm135/bigodin';

bigodin.addHelper('orElse', (value, fallback) => (isError(value) ? fallback : value));
bigodin.addHelper('errorMessage', (value) => (isError(value) ? value.message : ''));
```

```handlebars
Temperature: {{orElse (weather city) "unavailable"}}

{{= $user (user id)}}
{{#with $user}}Hi {{name}}!{{else}}Failed: {{errorMessage $user}}{{/with}}
```

Only helpers you write can expose error details, so you decide what reaches the output. Avoid rendering stack traces or internal messages for untrusted audiences.

## Recipe: report failures to the host

Tagged errors keep the render going, but the caller often still needs to know that something failed. Record the error in the [`data` channel](/docs/how-to/async-helpers#recipe-surface-data-back-to-the-host-via-thisdata) before returning it:

```javascript
bigodin.addHelper('user', async function (id) {
  try {
    return await api.getUser(id);
  } catch (error) {
    this.data.errors?.push({ helper: 'user', message: error.message });
    return new HelperError(error.message);
  }
});

const data = { errors: [] };
const html = await template({ id: 42 }, { data });

if (data.errors.length > 0) {
  logger.warn('render completed with helper errors', data.errors);
}
```

## Pitfalls

- **Only objects can be tagged.** A symbol cannot be attached to a string, number, or boolean. Return an object (or an `Error`) when you need to signal a failure.
- **Context data cannot carry the tag.** Bigodin clones the context before a run and copies string keys only, so `{ [errorTag]: true }` passed in the context arrives untagged. Only helper return values can be errors. See [The context clone](/docs/explanation/security-model#the-context-clone).
- **Throwing still fails the render.** Tagging is opt-in. A helper that throws rejects the whole render, as described in [Write async helpers](/docs/how-to/async-helpers#errors). Throw for bugs; tag for expected failures.
- **The symbol is shared across builds.** `errorTag` is `Symbol.for('bigodin.error')`, so objects tagged through the CommonJS build are recognized by the ESM build and vice versa. You can also create the tag without importing Bigodin, for example in a shared library.

## Related

- [Library API: Error returns](/docs/lib#error-returns)
- [Write async helpers](/docs/how-to/async-helpers)
- [Conditional blocks: what counts as truthy](/docs/language/conditional-blocks#what-counts-as-truthy)
- [Security model](/docs/explanation/security-model)
