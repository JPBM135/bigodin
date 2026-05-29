import { describe, it, expect } from 'vitest';
import { compile } from '../../src';

describe('helpers', () => {
  describe('code', () => {
    describe('return', () => {
      it('should return early', async () => {
        const templ = compile('foo{{return}}bar');
        expect(await templ()).toEqual('foo');
      });

      it('should work from inside conditional blocks', async () => {
        const templ = compile('foo{{#if bar}}{{return}}{{/if}}baz');
        expect(await templ({ bar: true })).toEqual('foo');
        expect(await templ({ bar: false })).toEqual('foobaz');
      });

      it('should halt from inside loop blocks', async () => {
        const templ = compile('0{{#each items}}{{#if stop}}{{return}}{{/if}}{{value}}{{/each}}9');
        expect(
          await templ({
            items: [
              { value: 1, stop: false },
              { value: 2, stop: false },
              { value: 3, stop: false },
              { value: 4, stop: true },
              { value: 5, stop: false },
            ],
          }),
        ).toEqual('0123');
      });

      it('should halt from inside context blocks', async () => {
        const templ = compile('A{{#with foo}}B{{#if stop}}{{return}}{{/if}}C{{/with}}D');
        expect(await templ({ foo: { stop: true } })).toEqual('AB');
      });

      it('should suppress everything after it, including further blocks', async () => {
        const templ = compile(
          'start{{return}}{{#if x}}mid{{/if}}{{#each xs}}{{$this}}{{/each}}end',
        );
        expect(await templ({ x: true, xs: [1, 2, 3] })).toEqual('start');
      });

      it('should suppress later variable assignments and their output', async () => {
        const templ = compile('a{{return}}{{= $v "set"}}{{$v}}');
        expect(await templ()).toEqual('a');
      });

      it('should render nothing itself', async () => {
        const templ = compile('[{{return}}]');
        expect(await templ()).toEqual('[');
      });
    });
  });
});
