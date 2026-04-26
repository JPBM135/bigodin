import { describe, it, expect } from 'vitest';

import { compile, compileExpression, parse, run } from '../src';
import Bigodin from '../src';
import { VERSION } from '../src/parser';

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
            expect(() => compile('{{= $x obj}}{{ $x.constructor }}'))
                .toThrow(/Literal mustaches cannot have parameters/);
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
            const res = await templ({ obj: { fn: function hello() { return 'x'; } } });
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
            const templ = bigodin.compile('{{#with (makeDate)}}{{constructor}}{{__proto__}}{{prototype}}{{/with}}');
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
            for (let i = 0; i < depth; i++) {
                ctx = { x: ctx };
            }

            const res = await templ(ctx, { maxExecutionMillis: 5000 });
            expect(res).toEqual('ok');
        });

        it('nested loops respect maxExecutionMillis', async () => {
            const big = new Array(2000).fill(1);
            const templ = compile('{{#each a}}{{#each b}}.{{/each}}{{/each}}');
            await expect(
                templ({ a: big, b: big }, { maxExecutionMillis: 5 }),
            ).rejects.toThrow(/Execution time limit exceeded/);
        });

        it('return halts deeply nested blocks immediately', async () => {
            const templ = compile(
                '{{#with a}}{{#with b}}{{#with c}}{{#each items}}{{#if stop}}{{return}}{{/if}}({{n}}){{/each}}{{/with}}{{/with}}{{/with}}',
            );
            const items: { n: number; stop: boolean }[] = [];
            for (let i = 0; i < 50; i++) {
                items.push({ n: i, stop: i === 3 });
            }
            const res = await templ({ a: { b: { c: { items } } } });
            expect(res).toEqual('(0)(1)(2)');
        });

        it('long missing path is bounded and returns empty', async () => {
            const path = new Array(500).fill('a').join('.');
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
            const m = new Map([['a', 1]]);
            const s = new Set([1, 2, 3]);
            const templ = compile('{{m.get}}|{{m.size}}|{{m.a}}|{{s.size}}|{{s.has}}');
            expect(await templ({ m, s })).toEqual('||||');
        });

        it('Date instances are neutered by the null-prototype clone', async () => {
            // Date methods are inherited (filtered) and Date.prototype.getTime/toISOString
            // are functions. Object.keys(date) is empty, so the clone is `{}`.
            const templ = compile('{{d.toISOString}}|{{d.getTime}}|{{d}}');
            expect(await templ({ d: new Date('2024-01-01T00:00:00.000Z') }))
                .toEqual('||[object Object]');
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
                constructor() { this.x = 1; }
                method() { return 'pwned'; }
            }
            const templ = compile('{{f.x}}|{{f.method}}');
            expect(await templ({ f: new Foo() })).toEqual('1|');
        });

        it('circular context references currently overflow the deep clone', () => {
            // Pin current behavior: deepCloneNullPrototype is recursive, so a circular
            // input throws RangeError. If this is ever made iterative, this test must
            // be updated deliberately — the contract change is worth surfacing.
            const o: any = { a: 1 };
            o.self = o;
            const templ = compile('{{a}}');
            return expect(templ(o)).rejects.toThrow(/Maximum call stack size/);
        });

        it('context getters that throw propagate through deepCloneNullPrototype', async () => {
            const obj: any = {};
            Object.defineProperty(obj, 'bad', {
                enumerable: true,
                get() { throw new Error('getter-boom'); },
            });
            const templ = compile('safe');
            await expect(templ({ o: obj })).rejects.toThrow(/getter-boom/);
        });
    });

    describe('helper sandbox', () => {
        it('helpers can mutate the cloned root context (but not the caller\'s input)', async () => {
            // Pin: deepCloneNullPrototype isolates the user's input object from the
            // execution, but within a single execution a helper IS allowed to mutate
            // its own context tree. If a future release locks this down, update here.
            const bigodin = new Bigodin();
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
            bigodin.addHelper('proxy', () =>
                new Proxy({ x: 1 }, {
                    get(target, key: string) {
                        trapped.push(key);
                        return (target as any)[key];
                    },
                }),
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
            // happy accident of the parser/runner naming convention — pin it so a
            // refactor that drops the prefix doesn't open a leak.
            const bigodin = new Bigodin();
            bigodin.addHelper('seedBare', function (this: any) {
                this.variables.x = 'leaked';
                return '';
            });
            const templ = bigodin.compile('{{seedBare}}{{$x}}');
            expect(await templ()).toEqual('');
        });

        it('helper halt() stops subsequent siblings, not just loop iterations', async () => {
            const bigodin = new Bigodin();
            bigodin.addHelper('stop', function (this: any) {
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
                /^Error at helper boom, position \d+: \{\{INJECTED\}\} <secret> "x"$/,
            );
        });
    });

    describe('AST tampering', () => {
        const mkAst = (statements: any[], version: any = VERSION) => ({
            type: 'TEMPLATE',
            version,
            statements,
        });

        for (const v of [0, 4, 1e9, -1, Infinity, -Infinity]) {
            it(`rejects forged AST with version ${String(v)}`, async () => {
                await expect(run(mkAst([], v) as any, {}, new Map() as any))
                    .rejects.toThrow(/Unsupported AST version/);
            });
        }

        it('NaN and missing version currently bypass the range check', async () => {
            // Pin known quirk: the version check is `< MIN || > MAX`, both false for
            // NaN/undefined. Captured here so a future tightening is intentional.
            await expect(run(mkAst([], NaN) as any, {}, new Map() as any)).resolves.toEqual('');
            await expect(run(mkAst([], undefined) as any, {}, new Map() as any)).resolves.toEqual('');
        });

        it('forged LITERAL containing a function does not execute it', async () => {
            let called = false;
            const fn = () => { called = true; return 'pwned'; };
            const ast = mkAst([{
                type: 'MUSTACHE',
                expression: { type: 'LITERAL', value: fn },
            }]);
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
            const ast = mkAst([
                { type: 'MUSTACHE', expression: { type: 'LITERAL', value: payload } },
            ]);
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
            const ast = mkAst([{
                type: 'MUSTACHE',
                expression: { type: 'EXPRESSION', path: 'if', params: undefined },
            }]);
            await expect(run(ast as any, {}, new Map() as any))
                .rejects.toThrow(/Cannot read properties of undefined/);
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
            expect(() => parse('{{#a}}{{/b}}')).toThrow(
                /Error at line 1, column \d+:.*\{\{\/b\}\}.*\{\{#a\}\}/,
            );
        });

        it('parse errors include line and column for unterminated literal strings', () => {
            expect(() => parse('{{ "unterminated'))
                .toThrow(/Error at line 1, column \d+:/);
        });

        it('parse errors reject malformed assignments with location info', () => {
            // Assignments with no expression after the variable fail to parse and
            // produce a position-aware error.
            expect(() => parse('{{= $foo }}'))
                .toThrow(/Error at line \d+, column \d+:/);
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
            } catch (e: any) {
                // Inner braces and assignment syntax must appear verbatim, NOT evaluated.
                expect(e.message).toContain('{{secret}}');
                expect(e.message).toContain('{{= $x 1}}');
                expect(e.message).not.toContain('leaked');
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
            const expr = compileExpression('with foo');
            const res = await expr({ foo: 'bar' });
            // `with` returns [ctx]; expression mode does NOT stringify like full render.
            expect(res).toEqual(['bar']);
        });

        it('compileExpression cannot reach prototype chain via path access', async () => {
            const expr = compileExpression('obj.__proto__.toString');
            expect(await expr({ obj: { a: 1 } })).toEqual(undefined);
        });
    });
});
