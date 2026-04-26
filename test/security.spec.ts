import { describe, it, expect } from 'vitest';

import { compile, compileExpression } from '../src';
import Bigodon from '../src';

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
            const bigodon = new Bigodon();
            const templ = bigodon.compile('{{ $this.constructor }}{{$root.constructor}}');
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
            const bigodon = new Bigodon();
            bigodon.addHelper('makeDate', () => new Date('2024-01-01T00:00:00.000Z'));
            const templ = bigodon.compile('{{#with (makeDate)}}{{constructor}}{{__proto__}}{{prototype}}{{/with}}');
            const res = await templ();
            expect(res).toEqual('');
        });

        it('helper-created objects do not expose methods through path access', async () => {
            const bigodon = new Bigodon();
            bigodon.addHelper('makeDate', () => new Date('2024-01-01T00:00:00.000Z'));
            const templ = bigodon.compile('{{#with (makeDate)}}{{toISOString}}{{getTime}}{{/with}}');
            const res = await templ();
            expect(res).toEqual('');
        });
    });
});
