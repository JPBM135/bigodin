import { describe, it, expect } from 'vitest';
import Bigodin, { compile } from '../../src';

describe('helpers', () => {
  describe('code', () => {
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

      it('should reach the outer context with $parent', async () => {
        const templ = compile('{{#with foo}}{{bar}}@{{$parent.label}}{{/with}}');
        expect(await templ({ label: 'L', foo: { bar: 'baz' } })).toEqual('baz@L');
      });

      it('should reach the root context with $root', async () => {
        const templ = compile('{{#with a}}{{#with b}}{{$root.top}}{{/with}}{{/with}}');
        expect(await templ({ top: 'T', a: { b: { x: 1 } } })).toEqual('T');
      });

      it('should render the else branch for falsy single arguments', async () => {
        const templ = compile('{{#with foo}}body{{else}}fallback{{/with}}');
        expect(await templ({ foo: null })).toEqual('fallback');
        expect(await templ({ foo: 0 })).toEqual('fallback');
        expect(await templ({ foo: '' })).toEqual('fallback');
        expect(await templ({ foo: [] })).toEqual('fallback');
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
        const templ = compile('{{#with maybe other}}body{{else}}fallback{{/with}}');
        expect(await templ({ maybe: null, other: undefined })).toEqual('fallback');
      });

      it('should pop every pushed frame after the body runs', async () => {
        const templ = compile('{{#with one two three}}in{{/with}}{{name}}');
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
        const templ = compile('{{^with maybe user}}none{{else}}some{{/with}}');
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
  });
});
