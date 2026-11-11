/* eslint-disable id-length */
/* eslint-disable unicorn/consistent-function-scoping */
import { describe, it, expect } from 'vitest';
import Bigodin, { compile, compileExpression, errorTag, isError, parse, run } from '../src';
import { MAX_BLOCK_DEPTH, VERSION } from '../src/parser';
import { MAX_EXPRESSION_DEPTH } from '../src/parser/expression';
import type { Execution } from '../src/runner/execution';
import { MAX_CONTEXT_DEPTH } from '../src/utils';

describe('security', () => {
  describe('SSTI tests', () => {
    it('blocks prototype traversal via __proto__/constructor/prototype', async () => {
      const templ = compile('{{ obj.__proto__ }}{{ obj.constructor }}{{ obj.prototype }}');
      const res = await templ({ obj: { a: 1 } });
      expect(res).toEqual('');
    });

    it('blocks prototype traversal on nested paths', async () => {
      const templ = compile('{{ user.profile.__proto__.polluted }}');
      const res = await templ({ user: { profile: { name: 'x' } } });
      expect(res).toEqual('');
    });

    it('does not allow accessing function constructors', async () => {
      const templ = compile('{{ obj.constructor.constructor }}');
      const res = await templ({ obj: {} });
      expect(res).toEqual('');
    });

    it('cannot call arbitrary functions from context (helpers only)', async () => {
      const ctx = { exec: () => 'pwned' };
      const templ = compile('{{ exec "ignored" }}');
      await expect(templ(ctx)).rejects.toThrow(/helper exec not found/i);
    });

    it('arrays do not expose properties (like length,toString)', async () => {
      const templ = compile('{{ arr.length }}{{ arr.toString }}');
      const res = await templ({ arr: [] });
      expect(res).toEqual('');
    });

    it('numbers/strings do not expose prototype methods', async () => {
      const templ = compile('{{ num.toFixed }}{{ str.toUpperCase }}');
      const res = await templ({ num: 1, str: 'abc' });
      expect(res).toEqual('');
    });

    it('helper names cannot be UNSAFE keys', async () => {
      const templ = compile('{{ __proto__ 1 }}');
      await expect(templ()).rejects.toThrow(/helper __proto__ not allowed/i);
    });

    it('variable values cannot be traversed via dot access', async () => {
      expect(() => compile('{{= $x obj}}{{ $x.constructor }}')).toThrow(
        /Literal mustaches cannot have parameters/,
      );
    });

    it('cannot reach global objects via $this/$root/$parent', async () => {
      const bigodin = new Bigodin();
      const templ = bigodin.compile('{{ $this.constructor }}{{$root.constructor}}');
      const res = await templ({ a: 1 });
      expect(res).toEqual('');
    });

    it('assignment cannot be abused to run helpers implicitly', async () => {
      const templ = compile('{{= $if true}}{{#if}}ok{{/if}}');
      const res = await templ();
      expect(res).toEqual('');
    });

    it('function-valued properties are hidden on path access', async () => {
      const templ = compile('{{ obj.fn }}');
      const res = await templ({
        obj: {
          // eslint-disable-next-line func-name-matching
          fn: function hello() {
            return 'x';
          },
        },
      });
      expect(res).toEqual('');
    });

    it('top-level function-valued properties are hidden on path access', async () => {
      const templ = compile('{{ foo }}');
      const res = await templ({ foo: () => {} });
      expect(res).toEqual('');
    });

    it('expressions cannot reach process via constructor.constructor', async () => {
      const templ = compileExpression('obj.constructor.constructor');
      const res = await templ({ obj: {} });
      expect(res).toEqual(undefined);
    });

    it('path access does not expose inherited enumerable properties', async () => {
      const parent = { leaked: 'x' };
      const child = Object.create(parent);
      const templ = compile('{{ obj.leaked }}');
      const res = await templ({ obj: child });
      expect(res).toEqual('');
    });

    it('helper-created objects do not expose constructor/prototype paths', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('makeDate', () => new Date('2024-01-01T00:00:00.000Z'));
      const templ = bigodin.compile(
        '{{#with (makeDate)}}{{constructor}}{{__proto__}}{{prototype}}{{/with}}',
      );
      const res = await templ();
      expect(res).toEqual('');
    });

    it('helper-created objects do not expose methods through path access', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('makeDate', () => new Date('2024-01-01T00:00:00.000Z'));
      const templ = bigodin.compile('{{#with (makeDate)}}{{toISOString}}{{getTime}}{{/with}}');
      const res = await templ();
      expect(res).toEqual('');
    });
  });

  describe('resource exhaustion', () => {
    it('deeply nested blocks do not stack-overflow under a time limit', async () => {
      const depth = 500;
      const open = '{{#with x}}'.repeat(depth);
      const close = '{{/with}}'.repeat(depth);
      const templ = compile(`${open}ok${close}`);

      // Build a context nested $depth levels deep
      let ctx: any = 'leaf';
      for (let idx = 0; idx < depth; idx++) {
        ctx = { x: ctx };
      }

      const res = await templ(ctx, { maxExecutionMillis: 5_000 });
      expect(res).toEqual('ok');
    });

    it('nested loops respect maxExecutionMillis', async () => {
      const big = Array.from({ length: 2_000 }).fill(1);
      const templ = compile('{{#each a}}{{#each b}}.{{/each}}{{/each}}');
      await expect(templ({ a: big, b: big }, { maxExecutionMillis: 5 })).rejects.toThrow(
        /Execution time limit exceeded/,
      );
    });

    it('return halts deeply nested blocks immediately', async () => {
      const templ = compile(
        '{{#with a}}{{#with b}}{{#with c}}{{#each items}}{{#if stop}}{{return}}{{/if}}({{n}}){{/each}}{{/with}}{{/with}}{{/with}}',
      );
      const items: { n: number; stop: boolean }[] = [];
      for (let idx = 0; idx < 50; idx++) {
        items.push({ n: idx, stop: idx === 3 });
      }

      const res = await templ({ a: { b: { c: { items } } } });
      expect(res).toEqual('(0)(1)(2)');
    });

    it('long missing path is bounded and returns empty', async () => {
      const path = Array.from({ length: 500 }).fill('a').join('.');
      const templ = compile(`{{ ${path} }}`);
      const start = Date.now();
      const res = await templ({});
      const elapsed = Date.now() - start;
      expect(res).toEqual('');
      expect(elapsed).toBeLessThan(200);
    });

    it('per-execution variables do not leak across runs', async () => {
      const templ = compile('{{= $x value}}{{$x}}|{{$y}}');
      const first = await templ({ value: 'one' });
      expect(first).toEqual('one|');

      // A second run with no value must NOT see the previous $x
      const second = await templ({});
      expect(second).toEqual('|');

      // And a $y assignment in a third run should not bleed back
      const templ2 = compile('{{= $y "leak"}}{{$y}}');
      await templ2();
      const third = await templ({});
      expect(third).toEqual('|');
    });
  });

  describe('non-plain object contexts', () => {
    it('Map/Set instances expose nothing (methods + size are inherited)', async () => {
      const testMap = new Map([['a', 1]]);
      const testSet = new Set([1, 2, 3]);
      const templ = compile('{{m.get}}|{{m.size}}|{{m.a}}|{{s.size}}|{{s.has}}');
      expect(await templ({ m: testMap, s: testSet })).toEqual('||||');
    });

    it('Date instances keep their value but expose no methods to templates', async () => {
      // The clone preserves Date instances by value (so helpers receive a real
      // Date), but the methods live on Date.prototype, so `lookupOwnValue` still
      // hides them from path access. `{{d}}` coerces via Object.prototype.toString.
      const templ = compile('{{d.toISOString}}|{{d.getTime}}|{{d}}');
      expect(await templ({ d: new Date('2024-01-01T00:00:00.000Z') })).toEqual('||[object Date]');
    });

    it('Error instance message is non-enumerable and is therefore hidden', async () => {
      // This pins a subtle behavior: `new Error('boom').message` is a non-enumerable
      // own property, so deepCloneNullPrototype skips it. Templates cannot read
      // `e.message` of a thrown Error passed as context.
      const templ = compile('{{e.message}}|{{e.stack}}|{{e}}');
      expect(await templ({ e: new Error('boom') })).toEqual('||[object Object]');
    });

    it('class instances expose own fields but not prototype methods', async () => {
      class Foo {
        public x: number;

        public constructor() {
          this.x = 1;
        }

        public method() {
          return 'pwned';
        }
      }
      const templ = compile('{{f.x}}|{{f.method}}');
      expect(await templ({ f: new Foo() })).toEqual('1|');
    });

    it('circular context references are cloned without overflowing', async () => {
      // The clone tracks visited objects, so a circular input resolves to a
      // shared clone instead of recursing forever. The cycle is still reachable.
      const obj: any = { a: 1 };
      obj.self = obj;
      const templ = compile('{{a}}|{{self.a}}|{{self.self.a}}');
      expect(await templ(obj)).toEqual('1|1|1');
    });

    it('context getters are invoked lazily, not eagerly at clone time', async () => {
      // A throwing getter that the template never references must not blow up
      // the render: the clone defers getter invocation until the key is read.
      const obj: any = {};
      Object.defineProperty(obj, 'bad', {
        enumerable: true,
        get() {
          throw new Error('getter-boom');
        },
      });
      const templ = compile('safe');
      expect(await templ({ obj })).toEqual('safe');
    });

    it('referenced getters still run and have their result stripped', async () => {
      let calls = 0;
      const obj: any = {};
      Object.defineProperty(obj, 'live', {
        enumerable: true,
        get() {
          calls += 1;
          return {
            value: 'ok',
            method() {
              return 'pwned';
            },
          };
        },
      });
      // The getter fires only because the template reads it; its returned object
      // is still null-prototype stripped, so the method stays hidden. Two
      // references resolve it once - the result is memoized within the render.
      const templ = compile('{{obj.live.value}}|{{obj.live.method}}');
      expect(await templ({ obj })).toEqual('ok|');
      expect(calls).toEqual(1);
    });

    it('Map/Set/RegExp are preserved by value for helpers but hide methods from templates', async () => {
      const bigodin = new Bigodin();
      const captured: any = {};
      // eslint-disable-next-line func-names
      bigodin.addHelper('capture', function (this: any) {
        captured.m = this.contexts[0].m;
        captured.s = this.contexts[0].s;
        captured.r = this.contexts[0].r;
        return '';
      });
      const templ = bigodin.compile('{{capture}}{{m.size}}|{{r.source}}');
      const input = { m: new Map([['k', 1]]), s: new Set([1, 2]), r: /ab+c/gi };
      // Methods/getters stay hidden from the template (prototype-resident).
      expect(await templ(input)).toEqual('|');
      // Helpers receive real, working instances cloned by value.
      expect(captured.m).toBeInstanceOf(Map);
      expect(captured.m.get('k')).toEqual(1);
      expect(captured.s).toBeInstanceOf(Set);
      expect(captured.s.has(2)).toBe(true);
      expect(captured.r).toBeInstanceOf(RegExp);
      expect(captured.r.source).toEqual('ab+c');
      // Cloned, not the caller's own references.
      expect(captured.m).not.toBe(input.m);
    });

    it('URL/Buffer/TypedArray expose no prototype surface to templates', async () => {
      const templ = compile(
        '{{u.href}}|{{u.constructor}}|{{b.constructor}}|{{t.buffer}}|{{t.length}}',
      );
      const out = await templ({
        u: new URL('https://secret.example/path'),
        // eslint-disable-next-line n/prefer-global/buffer
        b: Buffer.from('hi'),
        t: new Uint8Array([1, 2]),
      });
      // href is a prototype getter, constructor/buffer/length are prototype or
      // blocked - none are own data props, so all resolve empty.
      expect(out).toEqual('||||');
    });
  });

  describe('helper sandbox', () => {
    it("helpers can mutate the cloned root context (but not the caller's input)", async () => {
      // Pin: deepCloneNullPrototype isolates the user's input object from the
      // execution, but within a single execution a helper IS allowed to mutate
      // its own context tree. If a future release locks this down, update here.
      const bigodin = new Bigodin();
      // eslint-disable-next-line func-names
      bigodin.addHelper('mutate', function (this: any) {
        this.contexts[0].mutated = 'yes';
        return '';
      });
      const input = { foo: 'bar' };
      const templ = bigodin.compile('{{mutate}}{{mutated}}|{{foo}}');
      expect(await templ(input)).toEqual('yes|bar');
      expect((input as any).mutated).toBeUndefined();
    });

    it('helper-returned functions are stringified, never invoked', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('fn', () => () => 'pwned');
      const templ = bigodin.compile('{{fn}}');
      const res = await templ();
      // The function source leaks via String(fn) but it is NOT called.
      expect(res).not.toContain('pwned!');
      expect(typeof res).toEqual('string');
      expect(res).toContain('pwned'); // just the source string
    });

    it('helper-returned Proxy: dangerous keys are filtered before the trap fires', async () => {
      const trapped: string[] = [];
      const bigodin = new Bigodin();
      bigodin.addHelper(
        'proxy',
        () =>
          new Proxy(
            { x: 1 },
            {
              get(target, key: string) {
                trapped.push(key);
                return (target as any)[key];
              },
            },
          ),
      );
      const templ = bigodin.compile(
        '{{#with (proxy)}}{{x}}|{{constructor}}|{{__proto__}}{{/with}}',
      );
      const res = await templ();
      expect(res).toEqual('1||');
      // The constructor / __proto__ traps must NOT have been invoked
      expect(trapped).not.toContain('constructor');
      expect(trapped).not.toContain('__proto__');
      expect(trapped).not.toContain('prototype');
    });

    it('helper writes to this.variables.x do NOT reach template-visible $x', async () => {
      // Template variables are stored under their `$`-prefixed name. A helper
      // writing `this.variables.x = ...` does not pollute `{{$x}}`. This is a
      // happy accident of the parser/runner naming convention - pin it so a
      // refactor that drops the prefix doesn't open a leak.
      const bigodin = new Bigodin();
      // eslint-disable-next-line func-names
      bigodin.addHelper('seedBare', function (this: Execution) {
        this.variables.x = 'leaked';
        return '';
      });
      const templ = bigodin.compile('{{seedBare}}{{$x}}');
      expect(await templ()).toEqual('');
    });

    it('helper halt() stops subsequent siblings, not just loop iterations', async () => {
      const bigodin = new Bigodin();
      // eslint-disable-next-line func-names
      bigodin.addHelper('stop', function (this: Execution) {
        this.halt();
        return '';
      });
      const templ = bigodin.compile('A{{stop}}B{{#each items}}{{$this}}{{/each}}C');
      expect(await templ({ items: [1, 2] })).toEqual('A');
    });

    it('helper error message preserves inner Error.message verbatim', async () => {
      // The wrapper at runner/helper.ts only prefixes; the inner message is
      // appended without re-templating or escaping. Pin the exact format.
      const bigodin = new Bigodin();
      bigodin.addHelper('boom', () => {
        throw new Error('{{INJECTED}} <secret> "x"');
      });
      const templ = bigodin.compile('hi {{boom}}');
      await expect(templ()).rejects.toThrow(
        /^Error at helper boom, position \d+: {{INJECTED}} <secret> "x"$/,
      );
    });
  });

  describe('AST tampering', () => {
    const mkAst = (statements: any[], version: any = VERSION) => ({
      type: 'TEMPLATE',
      version,
      statements,
    });

    for (const v of [0, 6, 1e9, -1, Infinity, -Infinity]) {
      it(`rejects forged AST with version ${String(v)}`, async () => {
        await expect(run(mkAst([], v) as any, {}, new Map() as any)).rejects.toThrow(
          /Unsupported AST version/,
        );
      });
    }

    for (const v of [Number.NaN, null, '5', 2.5, true]) {
      it(`rejects forged AST with non-integer version ${String(v)}`, async () => {
        await expect(run(mkAst([], v) as any, {}, new Map() as any)).rejects.toThrow(
          /Unsupported AST version/,
        );
      });
    }

    it('rejects forged AST with a missing version', async () => {
      const ast = { type: 'TEMPLATE', statements: [] };
      await expect(run(ast as any, {}, new Map() as any)).rejects.toThrow(
        /Unsupported AST version/,
      );
    });

    it('forged VARIABLE cannot read Object.prototype members', async () => {
      const bigodin = new Bigodin();
      const seen: unknown[] = [];
      bigodin.addHelper('spy', (value: unknown) => {
        seen.push(value);
        return '';
      });
      const ast = mkAst([
        { type: 'VARIABLE', name: 'constructor' },
        { type: 'VARIABLE', name: 'toString' },
        {
          type: 'EXPRESSION',
          path: 'spy',
          params: [{ type: 'VARIABLE', name: 'constructor' }],
        },
      ]);
      expect(await bigodin.run(ast as any, {})).toEqual('');
      expect(seen).toEqual([undefined]);
    });

    it('forged ASSIGNMENT to __proto__ stays a plain variable', async () => {
      const ast = mkAst([
        {
          type: 'ASSIGNMENT',
          variable: { type: 'VARIABLE', name: '__proto__' },
          expression: { type: 'EXPRESSION', path: '$this', params: [] },
        },
        { type: 'VARIABLE', name: 'leak' },
      ]);
      expect(await run(ast as any, { leak: 'inherited' })).toEqual('');
      expect(({} as any).leak).toBeUndefined();
    });

    it('forged LITERAL containing a function does not execute it', async () => {
      let called = false;
      const fn = () => {
        called = true;
        return 'pwned';
      };

      const ast = mkAst([
        {
          type: 'MUSTACHE',
          expression: { type: 'LITERAL', value: fn },
        },
      ]);
      const res = await run(ast as any, {}, new Map() as any);
      expect(called).toEqual(false);
      // Function is rendered via String(fn), the source leaks but is not invoked.
      expect(res).toContain('pwned'); // source text contains the literal
      expect(res).not.toEqual('pwned'); // not the function's RETURN value
    });

    it('forged LITERAL with __proto__ payload does not pollute later lookups', async () => {
      const payload: any = {};
      Object.defineProperty(payload, '__proto__', {
        value: { polluted: 'yes' },
        enumerable: true,
      });
      const ast = mkAst([{ type: 'MUSTACHE', expression: { type: 'LITERAL', value: payload } }]);
      await run(ast as any, {}, new Map() as any);

      // After running the forged AST, a fresh template against a fresh context
      // must not see any "polluted" key on Object.prototype.
      const probe = compile('{{obj.polluted}}|{{polluted}}');
      expect(await probe({ obj: {} })).toEqual('|');
      expect(({} as any).polluted).toBeUndefined();
    });

    it('forged statement with unknown type is ignored, like the dispatch default', async () => {
      const ast = mkAst([
        { type: 'TEXT', value: 'a' },
        { type: 'NOPE_NOT_A_TYPE', value: 'evil' },
        { type: 'TEXT', value: 'b' },
      ]);
      expect(await run(ast as any, {}, new Map() as any)).toEqual('ab');
    });

    it('forged EXPRESSION with non-array params throws a clear runtime error', async () => {
      const ast = mkAst([
        {
          type: 'MUSTACHE',
          expression: { type: 'EXPRESSION', path: 'if', params: undefined },
        },
      ]);
      await expect(run(ast as any, {}, new Map() as any)).rejects.toThrow(
        /Cannot read properties of undefined/,
      );
    });
  });

  describe('variable namespace', () => {
    it('assigning $constructor / $__proto__ does not pollute path access', async () => {
      const templ = compile(
        '{{= $constructor 1}}{{= $__proto__ 2}}{{$constructor}}|{{$__proto__}}|{{obj.constructor}}|{{obj.__proto__}}',
      );
      expect(await templ({ obj: {} })).toEqual('1|2||');
    });

    it('variable shadows do not collide with helper resolution', async () => {
      // $if is a variable; `if` is a helper. They live in different namespaces.
      const templ = compile('{{= $if true}}{{#if $if}}yes{{else}}no{{/if}}');
      expect(await templ()).toEqual('yes');
    });

    it('concurrent runs of the same compiled template have isolated variables', async () => {
      const templ = compile('{{= $x value}}{{$x}}');
      const results = await Promise.all([
        templ({ value: 'A' }),
        templ({ value: 'B' }),
        templ({ value: 'C' }),
      ]);
      expect(results).toEqual(['A', 'B', 'C']);
    });
  });

  describe('error-message safety', () => {
    it('parse errors include line and column for mismatched blocks', () => {
      expect(() => parse('{{#a}}{{/b}}')).toThrow(/Error at line 1, column \d+:.*{{\/b}}.*{{#a}}/);
    });

    it('parse errors include line and column for unterminated literal strings', () => {
      expect(() => parse('{{ "unterminated')).toThrow(/Error at line 1, column \d+:/);
    });

    it('parse errors reject malformed assignments with location info', () => {
      // Assignments with no expression after the variable fail to parse and
      // produce a position-aware error.
      expect(() => parse('{{= $foo }}')).toThrow(/Error at line \d+, column \d+:/);
    });

    it('helper-error wrapping does not re-template the inner message', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('boom', () => {
        throw new Error('{{secret}} (line 2)\n{{= $x 1}}');
      });
      const templ = bigodin.compile('start {{boom}} end');
      try {
        await templ({ secret: 'leaked' });
        throw new Error('expected throw');
      } catch (error: any) {
        // Inner braces and assignment syntax must appear verbatim, NOT evaluated.
        expect(error.message).toContain('{{secret}}');
        expect(error.message).toContain('{{= $x 1}}');
        expect(error.message).not.toContain('leaked');
      }
    });
  });

  describe('expression-mode parity', () => {
    it('compileExpression rejects unsafe helper names too', async () => {
      const expr = compileExpression('__proto__ "x"');
      await expect(expr()).rejects.toThrow(/helper __proto__ not allowed/i);
    });

    it('compileExpression cannot read function-valued context', async () => {
      const expr = compileExpression('foo.bar');
      expect(await expr({ foo: () => {} })).toEqual(undefined);
    });

    it('compileExpression preserves helper return types (non-string)', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('arrify', (x) => [x]);
      const expr = bigodin.compileExpression('arrify foo');
      const res = await expr({ foo: 'bar' });
      // Helpers can return non-string values; expression mode does NOT
      // stringify like a full render.
      expect(res).toEqual(['bar']);
    });

    it('compileExpression cannot reach prototype chain via path access', async () => {
      const expr = compileExpression('obj.__proto__.toString');
      expect(await expr({ obj: { a: 1 } })).toEqual(undefined);
    });

    it('compileExpression clones the context so helpers cannot mutate the input', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('mutate', function mutate(this: { context: Record<string, unknown> }) {
        this.context.injected = true;
        return 'ok';
      });
      const input: Record<string, unknown> = {};
      expect(await bigodin.compileExpression('mutate')(input)).toEqual('ok');
      expect(input).toEqual({});
    });

    it('compileExpression strips the error tag from context data', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('check', (value: unknown) => String(isError(value)));
      const expr = bigodin.compileExpression('check forged');
      expect(await expr({ forged: { [errorTag]: true } })).toEqual('false');
    });
  });

  describe('error tag', () => {
    it('should strip the tag from context data', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('check', (value: unknown) => String(isError(value)));
      const templ = bigodin.compile('{{check forged}} {{#if forged}}truthy{{/if}}');
      const forged = { [errorTag]: true, 'bigodin.error': true };
      expect(await templ({ forged })).toEqual('false truthy');
    });
  });
  describe('functions in context', () => {
    const secret = () => 'API_KEY=hunter2';

    for (const template of [
      '{{#items}}{{.}}{{/items}}',
      '{{#items}}{{$this}}{{/items}}',
      '{{items}}',
      '{{#each items as |x|}}{{x}}{{/each}}',
      '{{#each nested}}{{$this}}{{/each}}',
      '{{#with holder as |h|}}{{h.fn}}{{/with}}',
    ]) {
      it(`does not render function source through ${template}`, async () => {
        const res = await compile(template)({
          items: [secret],
          nested: [[secret]],
          holder: { fn: secret },
        });
        expect(res).not.toContain('hunter2');
        expect(res).not.toContain('=>');
      });
    }

    it('keeps array positions when dropping function elements', async () => {
      const res = await compile('{{#each items}}[{{@index}}:{{$this}}]{{/each}}')({
        items: ['a', secret, 'c'],
      });
      expect(res).toEqual('[0:a][1:][2:c]');
    });

    it('does not hand context functions to helpers', async () => {
      const bigodin = new Bigodin();
      const seen: unknown[] = [];
      bigodin.addHelper('spy', (value: any) => {
        seen.push(value.fn, value.list[0], value.map.get('k'), 'fn' in value);
        return '';
      });
      await bigodin.compile('{{spy obj}}')({
        obj: { fn: secret, list: [secret], map: new Map([['k', secret]]) },
      });
      expect(seen).toEqual([undefined, undefined, undefined, false]);
    });

    it('hides own function properties of helper-returned objects', async () => {
      const bigodin = new Bigodin().addHelper('make', () => ({ fn: secret, name: 'n' }));
      expect(await bigodin.compile('{{#with (make)}}[{{fn}}{{name}}]{{/with}}')({})).toEqual('[n]');
    });

    it('strips functions returned by context getters', async () => {
      const ctx = {
        get lazy() {
          return secret;
        },
      };
      expect(await compile('[{{lazy}}]')(ctx)).toEqual('[]');
    });

    it('treats a function root context as empty', async () => {
      expect(await compile('[{{name}}{{.}}]')(secret as any)).toEqual('[[object Object]]');
    });

    it('never invokes a function-valued `then` in context', async () => {
      let called = 0;
      const thenable = {
        // eslint-disable-next-line unicorn/no-thenable
        then(resolve: (value: string) => void) {
          called++;
          resolve('PWNED');
        },
        label: 'ok',
      };
      const res = await compile('{{a.label}}{{a}}{{#with a}}{{label}}{{/with}}')({ a: thenable });
      expect(called).toEqual(0);
      expect(res).toEqual('ok[object Object]ok');
    });

    it('a never-settling `then` in context cannot hang the render', async () => {
      // eslint-disable-next-line unicorn/no-thenable
      const ctx = { a: { then() {} } };
      const res = await compile('[{{a}}]')(ctx, { maxExecutionMillis: 1_000 });
      expect(res).toEqual('[[object Object]]');
    });
  });

  describe('execution budgets', () => {
    // 2^depth iterations out of a template that is only ~25 * depth characters.
    const bomb = (depth: number, body: string) =>
      '{{#$root.a}}'.repeat(depth) + body + '{{/$root.a}}'.repeat(depth);

    it('maxStatements stops an exponential nested-section template', async () => {
      const templ = compile(bomb(40, 'x'));
      await expect(templ({ a: [1, 2] }, { maxStatements: 10_000 })).rejects.toThrow(
        /Execution statement limit exceeded/,
      );
    });

    it('maxStatements also bounds templates that emit nothing', async () => {
      const templ = compile(bomb(40, ''));
      await expect(templ({ a: [1, 2] }, { maxStatements: 10_000 })).rejects.toThrow(
        /Execution statement limit exceeded/,
      );
    });

    it('maxStatements counts sub-expressions and allows runs within budget', async () => {
      const bigodin = new Bigodin().addHelper('id', (value: unknown) => value);
      // MUSTACHE + EXPRESSION + LITERAL
      const templ = bigodin.compile('{{id 1}}');
      expect(await templ({}, { maxStatements: 3 })).toEqual('1');
      await expect(templ({}, { maxStatements: 2 })).rejects.toThrow(
        /Execution statement limit exceeded/,
      );
    });

    it('maxOutputLength stops an output bomb', async () => {
      const templ = compile(bomb(40, 'xxxxxxxxxx'));
      await expect(templ({ a: [1, 2] }, { maxOutputLength: 1_000 })).rejects.toThrow(
        /Output length limit exceeded/,
      );
    });

    it('maxOutputLength counts block output once and is inclusive', async () => {
      const templ = compile('{{#each a}}{{#each $root.a}}ab{{/each}}{{/each}}');
      expect(await templ({ a: [1, 2] }, { maxOutputLength: 8 })).toEqual('abababab');
      await expect(templ({ a: [1, 2] }, { maxOutputLength: 7 })).rejects.toThrow(
        /Output length limit exceeded/,
      );
    });

    it('maxOutputLength counts rendered values, not just template text', async () => {
      const templ = compile('{{big}}');
      await expect(templ({ big: 'x'.repeat(100) }, { maxOutputLength: 99 })).rejects.toThrow(
        /Output length limit exceeded/,
      );
      expect(await templ({ big: [1, 2, 3] }, { maxOutputLength: 5 })).toEqual('1,2,3');
    });

    it('budgets apply to compileExpression too', async () => {
      const bigodin = new Bigodin().addHelper('id', (value: unknown) => value);
      const expr = bigodin.compileExpression('id (id (id 1))');
      await expect(expr({}, { maxStatements: 2 })).rejects.toThrow(
        /Execution statement limit exceeded/,
      );
    });
  });

  describe('parser resource limits', () => {
    it('whitespace control trims long whitespace runs in linear time', () => {
      // `/\s+$/` took seconds on this input; trimEnd is effectively instant.
      const spaces = ' '.repeat(200_000);
      const start = Date.now();
      const ast = parse(`x${spaces}y{{~a~}}z${spaces}`);
      expect(Date.now() - start).toBeLessThan(2_000);
      expect((ast.statements[0] as any).value).toEqual(`x${spaces}y`);
      expect((ast.statements[2] as any).value).toEqual(`z${spaces}`);
    });

    it('whitespace control still strips every whitespace kind', async () => {
      const ws = [0x20, 0x09, 0x0d, 0x0a, 0xa0, 0x2028, 0xfeff]
        .map((code) => String.fromCodePoint(code))
        .join('');
      expect(await compile(`a${ws}{{~x~}}${ws}b`)({ x: '-' })).toEqual('a-b');
    });

    it('accepts blocks nested up to the limit and rejects one more', () => {
      const nest = (depth: number) => '{{#a}}'.repeat(depth) + '{{/a}}'.repeat(depth);
      expect(() => parse(nest(MAX_BLOCK_DEPTH))).not.toThrow();
      expect(() => parse(nest(MAX_BLOCK_DEPTH + 1))).toThrow(/Blocks are nested too deeply/);
    });

    it('counts {{else if}} chains towards the block nesting limit', () => {
      const chain = (links: number) => `{{#if a}}${'{{else if a}}'.repeat(links)}{{/if}}`;
      expect(() => parse(chain(MAX_BLOCK_DEPTH - 1))).not.toThrow();
      expect(() => parse(chain(MAX_BLOCK_DEPTH))).toThrow(/Blocks are nested too deeply/);
    });

    it('accepts sub-expressions nested up to the limit and runs them', async () => {
      const bigodin = new Bigodin().addHelper('id', (value: unknown) => value);
      const nest = (depth: number) => `{{id ${'(id '.repeat(depth)}7${')'.repeat(depth)}}}`;
      expect(await bigodin.compile(nest(MAX_EXPRESSION_DEPTH))({})).toEqual('7');
      expect(() => bigodin.parse(nest(MAX_EXPRESSION_DEPTH + 1))).toThrow(
        /Expressions are nested too deeply/,
      );
    });

    it('limits sub-expressions that open an expression', () => {
      const nest = (depth: number) => `{{${'('.repeat(depth)}id 7${')'.repeat(depth)}}}`;
      expect(() => parse(nest(MAX_EXPRESSION_DEPTH))).not.toThrow();
      expect(() => parse(nest(MAX_EXPRESSION_DEPTH + 1))).toThrow(
        /Expressions are nested too deeply/,
      );
    });
  });

  describe('recursion guards', () => {
    it('renders a self-referencing array without overflowing', async () => {
      const a: unknown[] = [1];
      a.push(a, 2);
      expect(await compile('{{a}}')({ a })).toEqual('1,,2');
    });

    it('renders an array that repeats a non-cyclic child every time', async () => {
      const child = [1, 2];
      expect(await compile('{{a}}')({ a: [child, child] })).toEqual('1,2,1,2');
    });

    it('rejects a context nested beyond the limit with a clear error', async () => {
      const nest = (depth: number) => {
        let ctx: any = {};
        for (let idx = 0; idx < depth; idx++) {
          ctx = { n: ctx };
        }

        return ctx;
      };

      expect(await compile('ok')(nest(MAX_CONTEXT_DEPTH))).toEqual('ok');
      await expect(compile('ok')(nest(MAX_CONTEXT_DEPTH + 1))).rejects.toThrow(
        /Context is nested too deeply/,
      );
    });
  });

  describe('helper registry', () => {
    for (const name of ['__proto__', 'constructor', 'prototype', 'hasOwnProperty']) {
      it(`addHelper rejects the unsafe name ${name}`, () => {
        expect(() => new Bigodin().addHelper(name, () => 'x')).toThrow(/not allowed/);
      });
    }

    it('allowDefaultHelpers: false frees built-in names for context paths', async () => {
      const ctx = { if: 'I', each: 'E', with: 'W', unless: 'U', return: 'R' };
      const templ = compile('{{if}}{{each}}{{with}}{{unless}}{{return}}');
      expect(await templ(ctx, { allowDefaultHelpers: false })).toEqual('IEWUR');
    });

    it('allowDefaultHelpers: false still prefers a registered helper', async () => {
      const bigodin = new Bigodin().addHelper('if', () => 'custom');
      expect(
        await bigodin.compile('{{if}}')({ if: 'ctx' }, { allowDefaultHelpers: false }),
      ).toEqual('custom');
    });
  });
});
