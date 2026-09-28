import { describe, it, expect } from 'vitest';
import Bigodin, { errorTag, isError } from '../../src';

const withFail = () => {
  const bigodin = new Bigodin();
  bigodin.addHelper('fail', (message = 'boom') => ({ [errorTag]: true, message }));
  return bigodin;
};

describe('runner', () => {
  describe('error tag', () => {
    it('should be a registered symbol', () => {
      expect(errorTag).toBe(Symbol.for('bigodin.error'));
    });

    it('should recognize objects with a truthy tag', () => {
      expect(isError({ [errorTag]: true })).toBe(true);
      expect(isError({ [errorTag]: 'yes' })).toBe(true);
      expect(isError(Object.assign(new Error('x'), { [errorTag]: true }))).toBe(true);
      expect(isError(Object.assign([1], { [errorTag]: true }))).toBe(true);
    });

    it('should recognize inherited tags', () => {
      class HelperError extends Error {}
      Object.defineProperty(HelperError.prototype, errorTag, { value: true });

      expect(isError(new HelperError('x'))).toBe(true);
      expect(isError(Object.create({ [errorTag]: true }))).toBe(true);
    });

    it('should not recognize untagged or falsy-tagged values', () => {
      for (const value of [
        'msg',
        0,
        null,
        undefined,
        {},
        [],
        new Error('x'),
        { [errorTag]: false },
      ]) {
        expect(isError(value)).toBe(false);
      }
    });

    it('should expose the tag and check as static members of Bigodin', () => {
      expect(Bigodin.errorTag).toBe(errorTag);
      expect(Bigodin.isError).toBe(isError);
    });

    it('should render as an empty string', async () => {
      const templ = withFail().compile('a{{fail}}b{{fail "truthy"}}c');
      expect(await templ()).toEqual('abc');
    });

    it('should render as empty inside arrays', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('list', () => [
        1,
        { [errorTag]: true },
        [Object.assign([2], { [errorTag]: true }), 3],
      ]);
      expect(await bigodin.compile('{{list}}')()).toEqual('1,,,3');
    });

    it('should be falsy for if blocks', async () => {
      const templ = withFail().compile('{{#if (fail)}}yes{{else}}no{{/if}}');
      expect(await templ()).toEqual('no');
    });

    it('should be falsy for unless blocks', async () => {
      const templ = withFail().compile('{{#unless (fail)}}yes{{else}}no{{/unless}}');
      expect(await templ()).toEqual('yes');
    });

    it('should be falsy for negated blocks', async () => {
      const templ = withFail().compile('{{^fail}}yes{{/fail}}');
      expect(await templ()).toEqual('yes');
    });

    it('should be falsy for each blocks', async () => {
      const templ = withFail().compile('{{#each (fail)}}item{{else}}empty{{/each}}');
      expect(await templ()).toEqual('empty');
    });

    it('should be falsy for tagged arrays in each blocks', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('items', () => Object.assign([1, 2], { [errorTag]: true }));
      const templ = bigodin.compile('{{#each (items)}}item{{else}}empty{{/each}}');
      expect(await templ()).toEqual('empty');
    });

    it('should be falsy for with blocks', async () => {
      const templ = withFail().compile('{{#with (fail)}}in{{else}}out{{/with}}');
      expect(await templ()).toEqual('out');
    });

    it('should be falsy for custom block helpers', async () => {
      const templ = withFail().compile('{{#fail}}yes{{else}}no{{/fail}}');
      expect(await templ()).toEqual('no');
    });

    it('should be falsy for the if and unless helpers', async () => {
      const templ = withFail().compile('{{if (fail)}} {{unless (fail)}}');
      expect(await templ()).toEqual('false true');
    });

    it('should be falsy when stored in a variable', async () => {
      const templ = withFail().compile('{{= $e (fail)}}{{#if $e}}yes{{else}}no{{/if}}');
      expect(await templ()).toEqual('no');
    });

    it('should pass the tagged object through to external helpers', async () => {
      const bigodin = withFail();
      bigodin.addHelper('fallback', (value: any, alt: unknown) =>
        isError(value) ? `${alt}:${value.message}` : value,
      );
      const templ = bigodin.compile('{{fallback (fail "oops") "alt"}} {{fallback "ok" "alt"}}');
      expect(await templ()).toEqual('alt:oops ok');
    });
  });
});
