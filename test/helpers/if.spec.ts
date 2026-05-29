import { describe, it, expect } from 'vitest';
import { compile } from '../../src';

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

      it('should render nothing when falsy and there is no else branch', async () => {
        const templ = compile('{{#if foo}}yes{{/if}}');
        expect(await templ({ foo: '' })).toEqual('');
        expect(await templ({})).toEqual('');
      });

      it('should treat falsy scalars as false', async () => {
        const templ = compile('{{#if foo}}yes{{else}}no{{/if}}');
        expect(await templ({ foo: 0 })).toEqual('no');
        expect(await templ({ foo: null })).toEqual('no');
        expect(await templ({ foo: undefined })).toEqual('no');
        expect(await templ({ foo: false })).toEqual('no');
      });

      it('should treat any non-empty string as true, including "0"', async () => {
        const templ = compile('{{#if foo}}yes{{else}}no{{/if}}');
        expect(await templ({ foo: '0' })).toEqual('yes');
        expect(await templ({ foo: ' ' })).toEqual('yes');
      });

      // `if` is `Boolean`, so it does NOT apply Mustache's "empty array is
      // falsy" rule the way a bare `{{#arr}}` section does. Both `[]` and `{}`
      // are truthy here. This diverges from Handlebars; lock it in so the
      // behavior can't drift silently.
      it('should treat empty array and empty object as true', async () => {
        const templ = compile('{{#if foo}}yes{{else}}no{{/if}}');
        expect(await templ({ foo: [] })).toEqual('yes');
        expect(await templ({ foo: {} })).toEqual('yes');
      });

      it('should support negation with ^', async () => {
        const templ = compile('{{^if foo}}no foo{{/if}}');
        expect(await templ({ foo: 0 })).toEqual('no foo');
        expect(await templ({ foo: 'x' })).toEqual('');
      });

      it('should render the else branch of a negated block when truthy', async () => {
        const templ = compile('{{^if foo}}no foo{{else}}has foo{{/if}}');
        expect(await templ({ foo: 'x' })).toEqual('has foo');
        expect(await templ({ foo: 0 })).toEqual('no foo');
      });

      it('should support {{else if}} chains', async () => {
        const templ = compile('{{#if a}}A{{else if b}}B{{else}}C{{/if}}');
        expect(await templ({ a: true })).toEqual('A');
        expect(await templ({ a: false, b: true })).toEqual('B');
        expect(await templ({ a: false, b: false })).toEqual('C');
      });

      it('should nest', async () => {
        const templ = compile('{{#if a}}{{#if b}}AB{{else}}A{{/if}}{{/if}}');
        expect(await templ({ a: true, b: true })).toEqual('AB');
        expect(await templ({ a: true, b: false })).toEqual('A');
        expect(await templ({ a: false, b: true })).toEqual('');
      });
    });
  });
});
