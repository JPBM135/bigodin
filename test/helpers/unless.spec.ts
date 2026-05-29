import { describe, it, expect } from 'vitest';
import { compile } from '../../src';

describe('helpers', () => {
  describe('code', () => {
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

      it('should render nothing when truthy and there is no else branch', async () => {
        const templ = compile('{{#unless foo}}yes{{/unless}}');
        expect(await templ({ foo: 'truthy' })).toEqual('');
      });

      it('should treat falsy scalars as the "unless" case', async () => {
        const templ = compile('{{#unless foo}}yes{{else}}no{{/unless}}');
        expect(await templ({ foo: 0 })).toEqual('yes');
        expect(await templ({ foo: null })).toEqual('yes');
        expect(await templ({ foo: undefined })).toEqual('yes');
        expect(await templ({})).toEqual('yes');
      });

      // `unless` is `!a`, the logical inverse of `if`. Like `if`, it treats
      // `[]` and `{}` as truthy (so the else branch runs), which mirrors the
      // `if` divergence from Handlebars. Pinning it keeps the pair symmetric.
      it('should treat empty array and empty object as truthy', async () => {
        const templ = compile('{{#unless foo}}yes{{else}}no{{/unless}}');
        expect(await templ({ foo: [] })).toEqual('no');
        expect(await templ({ foo: {} })).toEqual('no');
      });

      it('should run only once for arrays', async () => {
        const templ = compile('{{#unless foo}}yes{{else}}no{{/unless}}');
        expect(await templ({ foo: [1, 2, 3] })).toEqual('no');
      });

      it('should be the inverse of if for the same input', async () => {
        const ifTempl = compile('{{#if foo}}t{{else}}f{{/if}}');
        const unlessTempl = compile('{{#unless foo}}t{{else}}f{{/unless}}');
        for (const foo of ['x', '', 0, 1, null, [], {}, [1]]) {
          const ifOut = await ifTempl({ foo });
          const unlessOut = await unlessTempl({ foo });
          expect(unlessOut).toEqual(ifOut === 't' ? 'f' : 't');
        }
      });
    });
  });
});
