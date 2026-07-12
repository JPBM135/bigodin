/* eslint-disable id-length */
import { describe, it, expect } from 'vitest';
import Bigodin, { compile, lazy, LazyValue } from '../../src';

describe('runner', () => {
  describe('lazy values', () => {
    describe('resolution reach', () => {
      it('resolves a top-level lazy value', async () => {
        const res = await compile('{{value}}')({ value: lazy(() => 'loaded') });
        expect(res).toEqual('loaded');
      });

      it('resolves a lazy value mid-path', async () => {
        const res = await compile('{{user.profile.bio}}')({
          user: { profile: lazy(() => ({ bio: 'hello' })) },
        });
        expect(res).toEqual('hello');
      });

      it('resolves deeply nested lazies, one hop at a time', async () => {
        const res = await compile('{{a.b.c.d}}')({
          a: lazy(() => ({ b: lazy(() => ({ c: lazy(() => ({ d: 'deep' })) })) })),
        });
        expect(res).toEqual('deep');
      });

      it('resolves a lazy whole-context via {{.}}', async () => {
        const res = await compile('{{.}}')(lazy(() => 'whole'));
        expect(res).toEqual('whole');
      });

      it('resolves a lazy whole-context via {{$this}}', async () => {
        const res = await compile('{{$this}}')(lazy(() => 'self'));
        expect(res).toEqual('self');
      });

      it('resolves a lazy $root context', async () => {
        const res = await compile('{{$root.name}}')(lazy(() => ({ name: 'R' })));
        expect(res).toEqual('R');
      });

      it('resolves a bare lazy $root scalar', async () => {
        const res = await compile('{{$root}}')(lazy(() => 'ROOT'));
        expect(res).toEqual('ROOT');
      });

      it('resolves a lazy reached through $parent', async () => {
        const res = await compile('{{#each items}}{{#with sub}}{{$parent.top}}{{/with}}{{/each}}')({
          items: [lazy(() => ({ sub: { z: 1 }, top: 'T' }))],
        });
        expect(res).toEqual('T');
      });

      it('resolves a lazy passed to {{#with}}', async () => {
        const res = await compile('{{#with user}}{{bio}}{{/with}}')({
          user: lazy(() => ({ bio: 'present' })),
        });
        expect(res).toEqual('present');
      });

      it('resolves a lazy array passed to {{#each}}', async () => {
        const res = await compile('{{#each items}}{{name}}{{/each}}')({
          items: lazy(() => [{ name: 'a' }, { name: 'b' }]),
        });
        expect(res).toEqual('ab');
      });

      it('resolves lazy array elements pushed as context', async () => {
        const res = await compile('{{#each items}}{{n}}{{/each}}')({
          items: [lazy(() => ({ n: 'a' })), lazy(() => ({ n: 'b' }))],
        });
        expect(res).toEqual('ab');
      });

      it('resolves lazy array elements via {{.}}', async () => {
        const res = await compile('{{#each items}}{{.}}{{/each}}')({
          items: [lazy(() => 'a'), lazy(() => 'b')],
        });
        expect(res).toEqual('ab');
      });

      it('resolves a lazy bound to a block param', async () => {
        const res = await compile('{{#each items as |it|}}{{it.n}}{{/each}}')({
          items: [lazy(() => ({ n: 'a' })), lazy(() => ({ n: 'b' }))],
        });
        expect(res).toEqual('ab');
      });

      it('resolves a nested lazy on the next hop', async () => {
        const res = await compile('{{user.profile.bio}}')({
          user: lazy(() => ({ profile: lazy(() => ({ bio: 'nested' })) })),
        });
        expect(res).toEqual('nested');
      });

      it('resolves an async loader', async () => {
        const res = await compile('{{value}}')({ value: lazy(async () => 'async-result') });
        expect(res).toEqual('async-result');
      });
    });

    describe('resolved value types', () => {
      it('resolves a lazy scalar', async () => {
        expect(await compile('{{n}}')({ n: lazy(() => 42) })).toEqual('42');
      });

      it('renders a lazy boolean', async () => {
        expect(await compile('{{b}}')({ b: lazy(() => false) })).toEqual('false');
      });

      it('renders empty for a lazy resolving to null', async () => {
        expect(await compile('{{n}}')({ n: lazy(() => null) })).toEqual('');
      });

      it('renders empty for a lazy resolving to undefined', async () => {
        expect(await compile('{{n}}')({ n: lazy(() => undefined) })).toEqual('');
      });

      it('preserves a value-typed object (Date) through resolution', async () => {
        const bigodin = new Bigodin();
        bigodin.addHelper('year', (date: any) => date.getFullYear());
        const res = await bigodin.compile('{{year meta.created}}')({
          meta: lazy(() => ({ created: new Date('2020-06-15T00:00:00.000Z') })),
        });
        expect(res).toEqual('2020');
      });

      it('defers a getter on a resolved lazy object', async () => {
        const res = await compile('{{x.g}}')({
          x: lazy(() => {
            const o: any = {};
            Object.defineProperty(o, 'g', { enumerable: true, get: () => 'GOT' });
            return o;
          }),
        });
        expect(res).toEqual('GOT');
      });
    });

    describe('block subjects', () => {
      it('runs the {{#with}} else branch when the lazy is falsy', async () => {
        const res = await compile('{{#with u}}has{{else}}none{{/with}}')({ u: lazy(() => null) });
        expect(res).toEqual('none');
      });

      it('runs a negated block body when the lazy is falsy', async () => {
        const res = await compile('{{^u}}neg{{/u}}')({ u: lazy(() => null) });
        expect(res).toEqual('neg');
      });

      it('runs a negated block else branch when the lazy is truthy', async () => {
        const res = await compile('{{^u}}neg{{else}}pos{{/u}}')({ u: lazy(() => 'x') });
        expect(res).toEqual('pos');
      });

      it('drives {{#if}} from a resolved lazy', async () => {
        const templ = compile('{{#if f}}Y{{else}}N{{/if}}');
        expect(await templ({ f: lazy(() => true) })).toEqual('Y');
        expect(await templ({ f: lazy(() => false) })).toEqual('N');
      });

      it('drives {{#unless}} from a resolved lazy', async () => {
        const templ = compile('{{#unless f}}U{{/unless}}');
        expect(await templ({ f: lazy(() => false) })).toEqual('U');
        expect(await templ({ f: lazy(() => true) })).toEqual('');
      });

      it('runs the {{#each}} else branch for a lazy empty array', async () => {
        const res = await compile('{{#each a}}x{{else}}empty{{/each}}')({ a: lazy(() => []) });
        expect(res).toEqual('empty');
      });

      it('iterates a lazy array with {{$this}}', async () => {
        const res = await compile('{{#each a}}({{$this}}){{/each}}')({ a: lazy(() => [1, 2, 3]) });
        expect(res).toEqual('(1)(2)(3)');
      });
    });

    describe('memoization and cache', () => {
      it('loads once per render when referenced through one path twice', async () => {
        let calls = 0;
        const res = await compile('{{x.a}}{{x.a}}')({
          x: lazy(() => {
            calls += 1;
            return { a: 'v' };
          }),
        });
        expect(res).toEqual('vv');
        expect(calls).toEqual(1);
      });

      it('loads once when the same instance is aliased at two paths', async () => {
        let calls = 0;
        const u = lazy(() => {
          calls += 1;
          return { name: 'Ada' };
        });
        const res = await compile('{{author.name}}{{editor.name}}')({ author: u, editor: u });
        expect(res).toEqual('AdaAda');
        expect(calls).toEqual(1);
      });

      it('reloads on every reference when cache is disabled', async () => {
        let calls = 0;
        const res = await compile('{{y}}{{y}}')({
          y: lazy(
            () => {
              calls += 1;
              return String(calls);
            },
            { cache: false },
          ),
        });
        expect(res).toEqual('12');
        expect(calls).toEqual(2);
      });

      it('keeps cache:false through the clone for an aliased instance', async () => {
        let calls = 0;
        const u = lazy(
          () => {
            calls += 1;
            return String(calls);
          },
          { cache: false },
        );
        const res = await compile('{{a}}{{b}}')({ a: u, b: u });
        expect(res).toEqual('12');
        expect(calls).toEqual(2);
      });

      it('does not share memoization across renders', async () => {
        let calls = 0;
        const u = lazy(() => {
          calls += 1;
          return 'v';
        });
        const templ = compile('{{u}}');
        await templ({ u });
        await templ({ u });
        expect(calls).toEqual(2);
      });

      it('memoizes a recovered failure across references in one render', async () => {
        let calls = 0;
        const res = await compile('{{x}}{{x}}')({
          x: lazy(
            () => {
              calls += 1;
              throw new Error('e');
            },
            { onError: () => 'F' },
          ),
        });
        expect(res).toEqual('FF');
        expect(calls).toEqual(1);
      });
    });

    describe('error handling', () => {
      it('wraps a loader error with path and position', async () => {
        const run = compile('{{value}}')({
          value: lazy(() => {
            throw new Error('boom');
          }),
        });
        await expect(run).rejects.toThrow(
          /Error resolving lazy value at "value", position \d+: boom/,
        );
      });

      it('wraps a non-Error throw', async () => {
        const run = compile('{{value}}')({
          value: lazy(() => {
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw 'oops';
          }),
        });
        await expect(run).rejects.toThrow(
          /Error resolving lazy value at "value", position \d+: oops/,
        );
      });

      it('wraps a loader error without a position when loc is absent', async () => {
        const bigodin = new Bigodin();
        const run = bigodin.runExpression(
          { type: 'EXPRESSION', path: 'value', params: [] } as any,
          {
            value: lazy(() => {
              throw new Error('boom');
            }),
          },
        );
        await expect(run).rejects.toThrow(/Error resolving lazy value at "value": boom/);
      });

      it('returns the onError substitute (null)', async () => {
        const res = await compile('{{x}}')({
          x: lazy(
            () => {
              throw new Error('db');
            },
            { onError: () => null },
          ),
        });
        expect(res).toEqual('');
      });

      it('returns an onError scalar fallback', async () => {
        const res = await compile('{{x}}')({
          x: lazy(
            () => {
              throw new Error('db');
            },
            { onError: () => 'N/A' },
          ),
        });
        expect(res).toEqual('N/A');
      });

      it('returns and strips an onError fallback object', async () => {
        const res = await compile('{{user.name}}')({
          user: lazy(
            () => {
              throw new Error('db');
            },
            { onError: () => ({ name: 'Guest' }) },
          ),
        });
        expect(res).toEqual('Guest');
      });

      it('passes the raw error to onError', async () => {
        const res = await compile('{{x}}')({
          x: lazy(
            () => {
              throw new Error('boom');
            },
            { onError: (error: any) => `caught:${error.message}` },
          ),
        });
        expect(res).toEqual('caught:boom');
      });

      it('runs onError on every reference when cache is disabled', async () => {
        let handled = 0;
        const res = await compile('{{x}}{{x}}')({
          x: lazy(
            () => {
              throw new Error('e');
            },
            {
              cache: false,
              onError: () => {
                handled += 1;
                return 'E';
              },
            },
          ),
        });
        expect(res).toEqual('EE');
        expect(handled).toEqual(2);
      });

      it('wraps a re-thrown onError with path and position', async () => {
        const run = compile('{{user.name}}')({
          user: lazy(
            () => {
              throw new Error('db down');
            },
            {
              onError: (error) => {
                throw error;
              },
            },
          ),
        });
        await expect(run).rejects.toThrow(
          /Error resolving lazy value at "user.name", position \d+: db down/,
        );
      });
    });

    describe('helper interaction', () => {
      it('passes an already-resolved path value to a helper', async () => {
        const bigodin = new Bigodin();
        bigodin.addHelper('upper', (s: unknown) => String(s).toUpperCase());
        const res = await bigodin.compile('{{upper user.name}}')({
          user: lazy(() => ({ name: 'ada' })),
        });
        expect(res).toEqual('ADA');
      });

      it('resolves a lazy path inside a subexpression', async () => {
        const bigodin = new Bigodin();
        bigodin.addHelper('upper', (s: unknown) => String(s).toUpperCase());
        bigodin.addHelper('concat2', (a: unknown, b: unknown) => `${String(a)}${String(b)}`);
        const res = await bigodin.compile('{{concat2 (upper user.name) "!"}}')({
          user: lazy(() => ({ name: 'ada' })),
        });
        expect(res).toEqual('ADA!');
      });

      it('resolves a lazy assigned to a variable', async () => {
        const res = await compile('{{= $u val}}{{$u}}')({ val: lazy(() => 'assigned') });
        expect(res).toEqual('assigned');
      });

      it('resolves a nested lazy and passes non-lazy values through via this.resolveLazy', async () => {
        const bigodin = new Bigodin();
        bigodin.addHelper('bio', async function bioHelper(this: any, user: any) {
          const profile = await this.resolveLazy(user.profile);
          const plain = await this.resolveLazy('plain');
          return `${profile.text}-${plain}`;
        });
        const res = await bigodin.compile('{{bio user}}')({
          user: { profile: lazy(() => ({ text: 'hello' })) },
        });
        expect(res).toEqual('hello-plain');
      });

      it('strips an object resolved by this.resolveLazy', async () => {
        class Secret {
          public own = 'ok';

          public method() {
            return 'leak';
          }
        }
        const bigodin = new Bigodin();
        bigodin.addHelper('probe', async function probe(this: any, holder: any) {
          const obj = await this.resolveLazy(holder.value);
          return `${obj.own}|${obj.method === undefined}`;
        });
        const res = await bigodin.compile('{{probe holder}}')({
          holder: { value: lazy(() => new Secret()) },
        });
        expect(res).toEqual('ok|true');
      });

      it('applies onError when a helper resolves a failing lazy', async () => {
        const bigodin = new Bigodin();
        bigodin.addHelper('safe', async function safe(this: any, holder: any) {
          return this.resolveLazy(holder.value);
        });
        const res = await bigodin.compile('{{safe holder}}')({
          holder: {
            value: lazy(
              () => {
                throw new Error('x');
              },
              { onError: () => 'fallback' },
            ),
          },
        });
        expect(res).toEqual('fallback');
      });
    });

    describe('LazyValue class', () => {
      it('memoizes a cached value', async () => {
        let calls = 0;
        const a = lazy(() => {
          calls += 1;
          return calls;
        });
        await a.resolve();
        await a.resolve();
        expect(calls).toEqual(1);
      });

      it('memoizes a cached failure', async () => {
        let calls = 0;
        const a = lazy(() => {
          calls += 1;
          throw new Error('x');
        });
        await expect(a.resolve()).rejects.toThrow('x');
        await expect(a.resolve()).rejects.toThrow('x');
        expect(calls).toEqual(1);
      });

      it('does not memoize when cache is disabled', async () => {
        let calls = 0;
        const a = lazy(
          () => {
            calls += 1;
            return calls;
          },
          { cache: false },
        );
        await a.resolve();
        await a.resolve();
        expect(calls).toEqual(2);
      });

      it('does not memoize a failure when cache is disabled', async () => {
        let calls = 0;
        const a = lazy(
          () => {
            calls += 1;
            throw new Error('x');
          },
          { cache: false },
        );
        await expect(a.resolve()).rejects.toThrow('x');
        await expect(a.resolve()).rejects.toThrow('x');
        expect(calls).toEqual(2);
      });

      it('routes a failure through a sync onError', async () => {
        const a = lazy(
          () => {
            throw new Error('x');
          },
          { onError: () => 'fallback' },
        );
        expect(await a.resolve()).toEqual('fallback');
      });

      it('awaits an async onError', async () => {
        const a = lazy(
          () => {
            throw new Error('x');
          },
          { onError: async () => 'late' },
        );
        expect(await a.resolve()).toEqual('late');
      });

      it('fresh() returns a new, independently-memoized instance', async () => {
        let calls = 0;
        const a = new LazyValue(() => {
          calls += 1;
          return 'v';
        });
        const b = a.fresh();
        expect(b).not.toBe(a);
        expect(b).toBeInstanceOf(LazyValue);
        expect(await a.resolve()).toEqual('v');
        expect(await b.resolve()).toEqual('v');
        expect(calls).toEqual(2);
      });

      it('fresh() preserves the cache option', async () => {
        let calls = 0;
        const a = lazy(
          () => {
            calls += 1;
            return calls;
          },
          { cache: false },
        );
        const b = a.fresh();
        await b.resolve();
        await b.resolve();
        expect(calls).toEqual(2);
      });

      it('fresh() preserves the onError option', async () => {
        const a = lazy(
          () => {
            throw new Error('x');
          },
          { onError: () => 'F' },
        );
        expect(await a.fresh().resolve()).toEqual('F');
      });
    });
  });
});
