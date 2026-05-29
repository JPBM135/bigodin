import { describe, it, expect } from 'vitest';
import { compile } from '../../src';

describe('helpers', () => {
  describe('code', () => {
    describe('each', () => {
      it('should iterate over array', async () => {
        const templ = compile('{{#each arr}}({{$this}}){{/each}}');
        expect(await templ({ arr: [1, 2, 3] })).toEqual('(1)(2)(3)');
        expect(await templ({ arr: [] })).toEqual('');
      });

      it('should iterate over single non-array item', async () => {
        const templ = compile('{{#each arr}}({{$this}}){{/each}}');
        expect(await templ({ arr: 1 })).toEqual('(1)');
      });

      it('should wrap a single object in one iteration and use it as the context', async () => {
        const templ = compile('{{#each obj}}[{{name}}]{{/each}}');
        expect(await templ({ obj: { name: 'x' } })).toEqual('[x]');
      });

      it('should wrap a single string in one iteration without iterating its chars', async () => {
        const templ = compile('{{#each str}}[{{$this}}]{{/each}}');
        expect(await templ({ str: 'ab' })).toEqual('[ab]');
      });

      it('should iterate once over a wrapped null whose body produces only surrounding text', async () => {
        const templ = compile('{{#each foo}}[{{$this}}]{{/each}}');
        expect(await templ({ foo: null })).toEqual('[]');
      });

      it('should render the else branch for an empty array', async () => {
        const templ = compile('{{#each arr}}x{{else}}empty{{/each}}');
        expect(await templ({ arr: [] })).toEqual('empty');
      });

      it('should render nothing for an empty array without an else branch', async () => {
        const templ = compile('{{#each arr}}x{{/each}}');
        expect(await templ({ arr: [] })).toEqual('');
      });

      it('should expose @index, @first and @last during iteration', async () => {
        const templ = compile(
          '{{#each arr}}{{@index}}:{{$this}}{{#unless @last}},{{/unless}}{{/each}}',
        );
        expect(await templ({ arr: ['a', 'b', 'c'] })).toEqual('0:a,1:b,2:c');
      });

      it('should expose @key as the array index', async () => {
        const templ = compile('{{#each arr}}{{@key}}{{/each}}');
        expect(await templ({ arr: ['a', 'b'] })).toEqual('01');
      });

      it('should expose @first', async () => {
        const templ = compile('{{#each arr}}{{#if @first}}>{{/if}}{{$this}}{{/each}}');
        expect(await templ({ arr: ['a', 'b', 'c'] })).toEqual('>abc');
      });

      it('should reach the parent context with $parent', async () => {
        const templ = compile('{{#each arr}}{{$this}}@{{$parent.label}} {{/each}}');
        expect(await templ({ label: 'L', arr: ['a', 'b'] })).toEqual('a@L b@L ');
      });

      it('should nest and shadow @index per level', async () => {
        const templ = compile('{{#each outer}}{{#each inner}}{{@index}}{{/each}}|{{/each}}');
        expect(
          await templ({
            outer: [{ inner: ['a', 'b'] }, { inner: ['c'] }],
          }),
        ).toEqual('01|0|');
      });

      it('should support negation with ^ for empty collections', async () => {
        const templ = compile('{{^each arr}}none{{/each}}');
        expect(await templ({ arr: [] })).toEqual('none');
        expect(await templ({ arr: [1] })).toEqual('');
      });

      it('should render the else branch of a negated block when non-empty', async () => {
        const templ = compile('{{^each arr}}none{{else}}{{#each arr}}{{$this}}{{/each}}{{/each}}');
        expect(await templ({ arr: ['a', 'b'] })).toEqual('ab');
      });
    });
  });
});
