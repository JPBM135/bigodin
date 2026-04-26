import { describe, it, expect } from 'vitest';

import { compile } from '../../src';
import Bigodon from '../../src';

describe('runner', () => {
    describe('helper', () => {
        it('should execute helpers', async () => {
            const bigodon = new Bigodon();
            bigodon.addHelper('upper', (s: unknown) => String(s).toUpperCase());
            const templ = bigodon.compile('Hello, {{upper name }} {{upper "Schmidt" }}!');
            const result = await templ({ name: 'George' });
            expect(result).toEqual('Hello, GEORGE SCHMIDT!');
        });

        it('should execute nested helpers', async () => {
            const bigodon = new Bigodon();
            bigodon.addHelper('upper', (s: unknown) => String(s).toUpperCase());
            bigodon.addHelper('append', (a: unknown, b: unknown) => String(a) + String(b));
            const templ = bigodon.compile('Hello, {{upper (append name " schmidt") }}!');
            const result = await templ({ name: 'George' });
            expect(result).toEqual('Hello, GEORGE SCHMIDT!');
        });

        it('should execute parameterless helpers', async () => {
            const templ = compile('{{if}}');
            const result = await templ({ 'if': 'wrong' });
            expect(result).toEqual('false');
        });

        it('should execute parameterless extra helpers', async () => {
            const bigodon = new Bigodon();
            bigodon.addHelper('foo', () => 'bar');
            const templ = bigodon.compile('{{foo}}');
            const result = await templ({ foo: 'wrong' });
            expect(result).toEqual('bar');
        });

        it('should not execute non existing helpers', async () => {
            const templ = compile('Hello, {{non-existing name }}!');
            const result = templ({ name: 'George' });
            await expect(result).rejects.toThrow(/helper non-existing not found/i);
        });

        it('should not execute default helpers when disabled', async () => {
            const templ = compile('{{#if name}}yes{{else}}no{{/if}}');
            const result = templ({ name: 'George' }, { allowDefaultHelpers: false });
            await expect(result).rejects.toThrow(/helper if not found/i);
        });

        it('should allow default helpers when enabled', async () => {
            const templ = compile('{{#if name}}yes{{else}}no{{/if}}');
            const result = await templ({ name: 'George' }, { allowDefaultHelpers: true });
            expect(result).toEqual('yes');

            const templ2 = compile('{{#if name}}yes{{else}}no{{/if}}');
            const result2 = await templ2({ name: 'George' }, { allowDefaultHelpers: null as any });
            expect(result2).toEqual('yes');
        });

        it('should not allow unsafe keys as helper names', async () => {
            const templ = compile('Hello, {{__proto__ "Schmidt" }}!');
            await expect(templ()).rejects.toThrow(/helper __proto__ not allowed/i);
        });

        it('should run extra helpers', async () => {
            const bigodon = new Bigodon();
            bigodon.addHelper('add', (a: number, b: number) => a + b);
            const templ = bigodon.compile('{{add 1 2}}');
            const result = await templ(bigodon as any);
            expect(result).toEqual('3');
        });

        it('should prioritize extra helpers', async () => {
            const bigodon = new Bigodon();
            bigodon.addHelper('upper', () => 5);
            const templ = bigodon.compile('{{upper "hello"}}');
            const result = await templ(bigodon as any);
            expect(result).toEqual('5');
        });

        it('should preserve helper response types', async () => {
            const bigodon = new Bigodon();
            bigodon.addHelper('add', (a: number, b: number) => a + b);
            const templ = bigodon.compile('{{add (add 1 2) 4}}');
            const result = await templ(bigodon as any);
            expect(result).toEqual('7');
        });

        it('should run async helpers in series', async () => {
            const bigodon = new Bigodon();
            bigodon.addHelper('wait', (time: number) => new Promise(resolve => setTimeout(resolve, time)));
            const templ = bigodon.compile('{{wait 200}}{{wait 300}}');
            const start = Date.now();
            await templ(bigodon as any);
            const deltaT = Date.now() - start;
            expect(deltaT).toBeGreaterThanOrEqual(490);
            expect(deltaT).toBeLessThanOrEqual(590);
        });

        it('should pass execution to helpers', async () => {
            const bigodon = new Bigodon();
            bigodon.addHelper('setTitle', function (this: any, title: string) {
                this.data.title = title;
            });

            const templ = bigodon.compile('{{setTitle "Hello"}}');

            const data: any = {};
            await templ(bigodon as any, { data });
            expect(data.title).toEqual('Hello');
        });

        it('should log helper and location on error', async () => {
            const bigodon = new Bigodon();
            bigodon.addHelper('fail', () => { throw new Error('fail'); });

            const templ = bigodon.compile('{{fail}}');
            await expect(templ(bigodon as any)).rejects.toThrow('Error at helper fail, position 2: fail');
        });

        it('should log helper when no location on error', async () => {
            const bigodon = new Bigodon();
            bigodon.addHelper('fail', () => { throw new Error('fail'); });

            const ast = {
                type: 'TEMPLATE',
                version: 2,
                statements: [{
                    type: 'MUSTACHE',
                    expression: {
                        type: 'EXPRESSION',
                        path: 'fail',
                        params: [],
                    },
                }],
            };

            await expect(bigodon.run(ast as any, bigodon as any)).rejects.toThrow('Error at helper fail: fail');
        });
    });
});
