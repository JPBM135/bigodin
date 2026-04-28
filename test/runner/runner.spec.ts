import { describe, it, expect } from 'vitest';
import Bigodin, { compile, compileExpression, run } from '../../src';
import { VERSION } from '../../src/parser';
import { Execution } from '../../src/runner/execution';

describe('runner', () => {
  describe('Execution', () => {
    it('should use default values in of()', () => {
      const execution = Execution.of({});
      expect(execution.extraHelpers).toBeInstanceOf(Map);
      expect(execution.extraHelpers.size).toEqual(0);
      expect(execution.maxExecutionMillis).toEqual(Infinity);
      expect(execution.allowDefaultHelpers).toEqual(true);
    });

    it('should handle explicit undefined values for all options', () => {
      const execution = Execution.of({}, undefined, {
        data: undefined,
        maxExecutionMillis: undefined,
        allowDefaultHelpers: undefined,
      });
      expect(execution.maxExecutionMillis).toEqual(Infinity);
      expect(execution.allowDefaultHelpers).toEqual(true);
    });

    it('should handle zero maxExecutionMillis', () => {
      const execution = Execution.of({}, new Map(), { maxExecutionMillis: 0 });
      expect(execution.maxExecutionMillis).toEqual(Infinity);
    });

    it('should handle null maxExecutionMillis', () => {
      const execution = Execution.of({}, new Map(), {
        maxExecutionMillis: null as any,
      });
      expect(execution.maxExecutionMillis).toEqual(Infinity);
    });

    it('should handle null allowDefaultHelpers', () => {
      const execution = Execution.of({}, new Map(), {
        allowDefaultHelpers: null as any,
      });
      expect(execution.allowDefaultHelpers).toEqual(true);
    });

    it('should handle explicit true/false allowDefaultHelpers', () => {
      const e1 = Execution.of({}, new Map(), { allowDefaultHelpers: true });
      expect(e1.allowDefaultHelpers).toEqual(true);
      const e2 = Execution.of({}, new Map(), { allowDefaultHelpers: false });
      expect(e2.allowDefaultHelpers).toEqual(false);
    });
  });

  it('should not run unsupported versions', async () => {
    await expect(
      run({
        type: 'TEMPLATE',
        version: -1,
        statements: [],
      } as any),
    ).rejects.toThrow();

    await expect(
      run({
        type: 'TEMPLATE',
        version: 1e9,
        statements: [],
      } as any),
    ).rejects.toThrow();
  });

  it('should return text statements', async () => {
    const templ = compile('Lorem ipsum');
    expect(await templ()).toEqual('Lorem ipsum');
  });

  it('should ignore comments', async () => {
    const templ = compile('Lorem {{! ipsum }} dolor');
    expect(await templ()).toEqual('Lorem  dolor');
  });

  describe('mustache', () => {
    it('should return literal path expressions', async () => {
      const templ = compile('Hello, {{ "George" }}!');
      expect(await templ()).toEqual('Hello, George!');
    });

    it('should return simple path expressions', async () => {
      const templ = compile('Hello, {{ name }}!');
      expect(await templ({ name: 'George' })).toEqual('Hello, George!');
      expect(await templ()).toEqual('Hello, !');
      expect(await templ({})).toEqual('Hello, !');
      expect(await templ({ name: null })).toEqual('Hello, !');
      expect(await templ({ name: 5 })).toEqual('Hello, 5!');
      expect(await templ({ name: false })).toEqual('Hello, false!');
    });

    it('should return empty for function-valued simple path expressions', async () => {
      const templ = compile('Hello, {{ foo }}!');
      expect(await templ({ foo: () => {} })).toEqual('Hello, !');
    });

    it('should return deep path expressions', async () => {
      const templ = compile('Hello, {{ name.first }} {{ name.last }}!');
      expect(await templ({ name: { first: 'George', last: 'Schmidt' } })).toEqual(
        'Hello, George Schmidt!',
      );
      expect(await templ()).toEqual('Hello,  !');
      expect(await templ({})).toEqual('Hello,  !');
      expect(await templ({ name: null })).toEqual('Hello,  !');
      expect(await templ({ name: 5 })).toEqual('Hello,  !');
      expect(await templ({ name: false })).toEqual('Hello,  !');
    });

    it('should return empty for function-valued deep path expressions', async () => {
      const templ = compile('Hello, {{ foo.bar }}!');
      expect(await templ({ foo: () => {} })).toEqual('Hello, !');
    });

    it('should return empty for function-valued own properties', async () => {
      const templ = compile('{{ obj.fn }}');
      expect(
        await templ({
          obj: {
            fn() {
              return 'x';
            },
          },
        }),
      ).toEqual('');
    });

    it('should allow $this for helper-path disambiguisation', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('foo', () => 'wrong');
      const templ = bigodin.compile('{{ $this.foo }} {{ $this.obj.deep }}');
      expect(await templ({ foo: 'bar', obj: { deep: 'baz' } })).toEqual('bar baz');
    });

    it('should return context values converted to string', async () => {
      const templ = compile(
        '{{ obj }} {{ arr }} {{ str }} {{ num }} {{ bTrue }} {{ bFalse }} {{ nil }} {{ undef }}',
      );
      expect(
        await templ({
          obj: {},
          arr: [],
          str: 'foo',
          num: 0,
          bTrue: true,
          bFalse: false,
          nil: null,
          undef: void 0,
        }),
      ).toEqual('[object Object] [object Array] foo 0 true false  ');
    });

    it('should ignore unsafe keys', async () => {
      const templ = compile('Hello, {{ name.constructor }} {{ name.__proto__ }}!');
      expect(
        await templ({
          name: {
            __proto__: 'foo',
            constructor: 'bar',
          },
        }),
      ).toEqual('Hello,  !');
    });

    it('should not return Object prototype keys', async () => {
      const templ = compile('{{ hasOwnProperty }}{{ obj.toString }}{{ obj.hasOwnProperty }}');
      expect(await templ({ obj: {} })).toEqual('');
    });

    it('should not return Array prototype keys', async () => {
      const templ = compile('{{ arr.length }}{{ arr.toString }}');
      expect(await templ({ arr: [] })).toEqual('');
    });

    it('should not return String prototype keys', async () => {
      const templ = compile('{{ str.length }}{{ str.toString }}');
      expect(await templ({ str: 'yada' })).toEqual('');
    });

    it('should not return Number prototype keys', async () => {
      const templ = compile('{{ num.toString }}{{ num.toFixed }}');
      expect(await templ({ num: 1 })).toEqual('');
    });

    it('should ignore unknown statements', async () => {
      const result = await run({
        type: 'TEMPLATE',
        version: VERSION,
        statements: [
          {
            type: 'TEXT',
            value: 'foo',
          },
          {
            type: 'ABLUEBLUE',
            value: 'noope',
          },
          {
            type: 'TEXT',
            value: 'bar',
          },
        ],
      } as any);

      expect(result).toEqual('foobar');
    });
  });

  describe('expressions', () => {
    it('should return undefined with literal with no value', async () => {
      const templ = compileExpression('foo');
      expect(await templ()).toEqual(undefined);
    });

    it('should return literal value', async () => {
      const templ = compileExpression('foo');
      expect(await templ({ foo: 'bar' })).toEqual('bar');
    });

    it('should return undefined for function-valued expression results', async () => {
      const templ = compileExpression('foo');
      expect(await templ({ foo: () => {} })).toEqual(undefined);
    });

    it('should return undefined for function-valued expression traversal', async () => {
      const templ = compileExpression('foo.bar');
      expect(await templ({ foo: () => {} })).toEqual(undefined);
    });

    it('should evaluate expression as true', async () => {
      const templ = compileExpression('if foo');
      expect(await templ({ foo: 'bar' })).toEqual(true);
    });

    it('should evaluate expression as false', async () => {
      const templ = compileExpression('if foo');
      expect(await templ({ foo: '' })).toEqual(false);
    });

    it('should evaluate more complex expression as true', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('eq', (a: any, b: any) => a === b);
      bigodin.addHelper('startsWith', (string: any, value: any) =>
        String(string).startsWith(value),
      );
      bigodin.addHelper('and', (...args: any[]) => args.every(Boolean));
      const templ = bigodin.compileExpression('and (startsWith foo "b") (eq fruit "apple")');
      expect(await templ({ foo: 'bar', fruit: 'apple' })).toEqual(true);
    });
  });

  describe('time limit', () => {
    const bigArray = Array.from({ length: 1e6 }).fill(1);
    const source = `{{#each bigArray}}"foo"{{/each}}`;
    const templ = compile(source);

    it('should interrupt execution after limit', async () => {
      await templ({ bigArray }, { maxExecutionMillis: 5 }).catch(() => {});

      const promise = templ(
        { bigArray },
        {
          maxExecutionMillis: 50,
        },
        // eslint-disable-next-line promise/prefer-await-to-then
      ).catch(() => {});

      const start = Date.now();
      await promise;
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(55);
      expect(elapsed).toBeGreaterThan(49);
    });

    it('should interrupt execution with error', async () => {
      const promise = templ({ bigArray }, { maxExecutionMillis: 5 });
      await expect(promise).rejects.toThrow('Execution time limit exceeded');
    });

    it('should not interrupt when execution takes less than limit', async () => {
      const template = compile('Hello, {{foo}}');
      expect(await template({ foo: 'bar' }, { maxExecutionMillis: 50 })).toEqual('Hello, bar');
    });

    it('cannot abort a single async helper mid-await', async () => {
      // Pin current behavior: runStatement only checks elapsedMillis at the
      // TOP of each statement. A helper that's already started cannot be
      // interrupted - it will finish, even if it overshoots the limit. Only
      // *subsequent* statements are aborted. This test proves the helper
      // ran to completion despite the 5ms budget.
      const bigodin = new Bigodin();
      let finished = false;
      bigodin.addHelper(
        'slow',
        async () =>
          new Promise<string>((resolve) => {
            setTimeout(() => {
              finished = true;
              resolve('ok');
            }, 100);
          }),
      );
      const templ = bigodin.compile('{{slow}}');
      const start = Date.now();
      const res = await templ({}, { maxExecutionMillis: 5 });
      const elapsed = Date.now() - start;
      expect(res).toEqual('ok');
      expect(finished).toEqual(true);
      expect(elapsed).toBeGreaterThanOrEqual(95);
    });

    it('aborts the statement that follows an overshoot', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper(
        'slow',
        async () =>
          new Promise((resolve) => {
            setTimeout(resolve, 100);
          }),
      );
      const templ = bigodin.compile('{{slow}}after');
      await expect(templ({}, { maxExecutionMillis: 5 })).rejects.toThrow(
        /Execution time limit exceeded/,
      );
    });
  });

  describe('concurrent runs', () => {
    it('share no Execution state between parallel invocations', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper(
        'wait',
        async (ms: number) =>
          new Promise((resolve) => {
            setTimeout(resolve, ms);
          }),
      );
      const templ = bigodin.compile('{{= $x label}}{{wait ms}}{{$x}}');

      const results = await Promise.all([
        templ({ label: 'A', ms: 30 }),
        templ({ label: 'B', ms: 5 }),
        templ({ label: 'C', ms: 15 }),
      ]);
      expect(results).toEqual(['A', 'B', 'C']);
    });

    it('does not leak the data side-channel across concurrent runs', async () => {
      const bigodin = new Bigodin();
      // eslint-disable-next-line func-names
      bigodin.addHelper('tag', function (this: any, v: string) {
        this.data.tag = v;
        return '';
      });
      const templ = bigodin.compile('{{tag label}}');

      const dataA: any = {};
      const dataB: any = {};
      await Promise.all([
        templ({ label: 'A' }, { data: dataA }),
        templ({ label: 'B' }, { data: dataB }),
      ]);
      expect(dataA.tag).toEqual('A');
      expect(dataB.tag).toEqual('B');
    });
  });
});
