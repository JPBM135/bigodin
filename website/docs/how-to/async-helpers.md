---
title: 'Write async helpers'
sidebar_position: 4
---

**Problem.** A template needs a value that requires I/O, a database query, an HTTP call, a file read. You want to keep the template readable and let the helper do the asynchronous work.

**Why this works.** Bigodin awaits helper return values. If a helper returns a promise, the runner awaits it before substituting the value. Helper parameters are evaluated in parallel (`Promise.all`) before being passed to the helper, so subexpressions that themselves call async helpers are also handled.

## Recipe: a helper that hits HTTP

```javascript
import Bigodin from '@jpbm135/bigodin';

const bigodin = new Bigodin();

bigodin.addHelper('weather', async (city) => {
  const res = await fetch(`https://api.example.com/weather?city=${encodeURIComponent(city)}`);
  if (!res.ok) throw new Error(`weather lookup failed: ${res.status}`);
  const { temperature } = await res.json();
  return temperature;
});

const template = bigodin.compile('It is {{weather city}}°C in {{city}}.');

await template({ city: 'Lisbon' });
// "It is 18°C in Lisbon."
```

If the fetch rejects, the render rejects with the same error. There is no built-in retry; wrap the helper if you want one.

## Recipe: a helper that hits a database

The pattern is the same; the dependency comes from a closure. Capture the connection (or any other context) when you register the helper:

```javascript
function registerHelpers(bigodin, db) {
  bigodin.addHelper('user', async (id) => {
    const row = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return row[0];
  });
}

const bigodin = new Bigodin();
registerHelpers(bigodin, db);

const template = bigodin.compile('{{#with (user id)}}{{name}}{{/with}}');
await template({ id: 42 });
```

## Recipe: parallel data fetching

Multiple helper parameters are awaited in parallel, so this issues both queries at once:

```handlebars
{{combine (user id) (orders id)}}
```

```javascript
bigodin.addHelper('combine', (user, orders) => `${user.name} has ${orders.length} orders`);
```

Both `(user id)` and `(orders id)` start before either completes. If you call them sequentially in your own code, you would lose this for free.

## Recipe: surface data back to the host via `this.data`

Templates cannot read from the host beyond the context they are given. Helpers, however, receive an `Execution` instance as `this`, with a `data` channel that is **only visible to helpers** (not to the template):

```javascript
bigodin.addHelper('setTitle', function (title) {
  if (this.data) this.data.title = title;
  return '';
});

const data = {};
const template = bigodin.compile('{{setTitle (uppercase headline)}}<h1>{{headline}}</h1>');
const html = await template({ headline: 'lorem ipsum' }, { data });

console.log(data.title); // "LOREM IPSUM"
console.log(html); // "<h1>lorem ipsum</h1>"
```

This is the supported way for a template to "return" anything other than a string: page titles, meta tags, audit log entries, accumulated warnings.

## Errors

A helper that throws (sync or async) rejects the entire render with the original error:

```javascript
bigodin.addHelper('user', async (id) => {
  if (!Number.isFinite(id)) throw new TypeError('id must be a number');
  return db.user(id);
});
```

If you want a render to continue past a failed helper, catch inside the helper and return a sentinel. There is no per-helper `try/catch` in the template language.

## Performance notes

- Helper parameters resolve in parallel; helper bodies do not. Two top-level `{{slow}}` mustaches in a row run sequentially.
- The runner checks `maxExecutionMillis` between statements. A single async helper that takes longer than the budget will still complete, but the next statement will trip the wall.
- There is no helper-level cache. If `{{user 42}}` appears five times in the same template, the helper runs five times. Memoize inside the helper if needed.

## Related

- [Bound execution time](/docs/how-to/bound-execution-time) for budgets and early exit
- [Library API](/docs/lib#execution-the-helper-this) for the `Execution` shape
