import { describe, it, expect } from 'vitest';
import Bigodin, { compile } from '../../src';

describe('helpers', () => {
  describe('code', () => {
    describe('if', () => {
      it('should evaluate on true, only', async () => {
        const templ = compile('{{#if foo}}yes{{else}}no{{/if}}');
        expect(await templ({ foo: 'foo' })).toEqual('yes');
        expect(await templ({ foo: '' })).toEqual('no');
      });

      it('should not change context', async () => {
        const templ = compile('{{#if foo}}{{name}}{{else}}no{{/if}}');
        expect(await templ({ foo: { name: 'wrong' }, name: 'foo' })).toEqual('foo');
      });

      it('should run only once', async () => {
        const templ = compile('{{#if foo}}yes{{else}}no{{/if}}');
        expect(await templ({ foo: [1, 2, 3] })).toEqual('yes');
      });
    });

    describe('unless', () => {
      it('should evaluate on false, only', async () => {
        const templ = compile('{{#unless foo}}yes{{else}}no{{/unless}}');
        expect(await templ({ foo: 'foo' })).toEqual('no');
        expect(await templ({ foo: '' })).toEqual('yes');
      });

      it('should not change context', async () => {
        const templ = compile('{{#unless foo}}no{{else}}{{name}}{{/unless}}');
        expect(await templ({ foo: { name: 'wrong' }, name: 'foo' })).toEqual('foo');
      });
    });

    describe('with', () => {
      it('should evaluate with the given context of string, number and boolean', async () => {
        const templ = compile('{{#with foo}}{{$this}}{{/with}}');
        expect(await templ({ foo: 'foo' })).toEqual('foo');
        expect(await templ({ foo: 5 })).toEqual('5');
        expect(await templ({ foo: true })).toEqual('true');
      });

      it('should evaluate with the given context of object', async () => {
        const templ = compile('{{#with foo}}{{bar}}{{/with}}');
        expect(await templ({ foo: { bar: 'baz' } })).toEqual('baz');
      });

      it('should evaluate with the given context of array', async () => {
        const templ = compile('{{#with foo}}{{#each $this}}{{$this}}{{/each}}{{/with}}');
        expect(await templ({ foo: ['bar', 'baz'] })).toEqual('barbaz');
      });

      it('should change context', async () => {
        const templ = compile('{{#with foo}}{{bar}}{{/with}}');
        expect(await templ({ foo: {}, bar: 'wrong' })).toEqual('');
        expect(await templ({ foo: [], bar: 'wrong' })).toEqual('');
        expect(await templ({ foo: 'foo', bar: 'wrong' })).toEqual('');
        expect(await templ({ foo: 5, bar: 'wrong' })).toEqual('');
        expect(await templ({ foo: true, bar: 'wrong' })).toEqual('');
        expect(await templ({ foo: false, bar: 'wrong' })).toEqual('');
        expect(await templ({ foo: null, bar: 'wrong' })).toEqual('');
        expect(await templ({ foo: undefined, bar: 'wrong' })).toEqual('');
      });

      it('should run only once for arrays', async () => {
        const templ = compile('{{#with foo}}bar{{/with}}');
        expect(await templ({ foo: [1, 2, 3] })).toEqual('bar');
      });

      it('should push each truthy argument as its own frame and run the body once', async () => {
        const templ = compile('{{#with user company}}{{name}} @ {{$parent.name}}{{/with}}');
        expect(
          await templ({
            user: { name: 'Alice' },
            company: { name: 'Acme' },
          }),
        ).toEqual('Acme @ Alice');
      });

      it('should let inner frames shadow outer frames', async () => {
        const templ = compile('{{#with outer inner}}{{label}}|{{$parent.label}}{{/with}}');
        expect(
          await templ({
            outer: { label: 'O' },
            inner: { label: 'I' },
          }),
        ).toEqual('I|O');
      });

      it('should skip falsy arguments and still push the truthy ones', async () => {
        const templ = compile('{{#with maybe user}}{{name}}{{/with}}');
        expect(
          await templ({
            maybe: null,
            user: { name: 'Alice' },
          }),
        ).toEqual('Alice');
      });

      it('should render the else branch when every argument is falsy', async () => {
        const templ = compile(
          '{{#with maybe other}}body{{else}}fallback{{/with}}',
        );
        expect(await templ({ maybe: null, other: undefined })).toEqual('fallback');
      });

      it('should pop every pushed frame after the body runs', async () => {
        const templ = compile(
          '{{#with one two three}}in{{/with}}{{name}}',
        );
        expect(
          await templ({
            one: { x: 1 },
            two: { x: 2 },
            three: { x: 3 },
            name: 'after',
          }),
        ).toEqual('inafter');
      });

      it('should let user-registered with helper override the native behavior', async () => {
        const bigodin = new Bigodin();
        bigodin.addHelper('with', () => 'custom');
        const templ = bigodin.compile('{{#with foo bar}}body{{/with}}');
        expect(await templ({ foo: { x: 1 }, bar: { x: 2 } })).toEqual('body');
      });

      it('should treat negated with as truthy when every argument is falsy', async () => {
        const templ = compile('{{^with maybe other}}none{{/with}}');
        expect(await templ({ maybe: null, other: false })).toEqual('none');
      });

      it('should render the else branch on negated with when at least one argument is truthy', async () => {
        const templ = compile(
          '{{^with maybe user}}none{{else}}some{{/with}}',
        );
        expect(await templ({ maybe: null, user: { name: 'Alice' } })).toEqual('some');
      });

      it('should render nothing on negated with without an else when at least one argument is truthy', async () => {
        const templ = compile('{{^with user}}none{{/with}}');
        expect(await templ({ user: { name: 'Alice' } })).toEqual('');
      });

      it('should ignore inline with calls (returns undefined)', async () => {
        const templ = compile('a{{with foo}}b');
        expect(await templ({ foo: { x: 1 } })).toEqual('ab');
      });
    });

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
    });

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
    });
  });
});
