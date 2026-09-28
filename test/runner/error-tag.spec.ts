import { describe, it, expect } from 'vitest';
import Bigodin, { isError, markError, unwrapError } from '../../src';

const withFail = () => {
  const bigodin = new Bigodin();
  bigodin.addHelper('fail', (value?: unknown) => markError(value ?? new Error('boom')));
  return bigodin;
};

describe('runner', () => {
  describe('error tag', () => {
    it('should tag any value, including primitives and undefined', () => {
      for (const value of ['msg', 0, 1, true, null, undefined, { a: 1 }, new Error('x')]) {
        const tagged = markError(value);
        expect(isError(tagged)).toBe(true);
        expect(unwrapError(tagged)).toBe(value);
      }
    });

    it('should return a frozen null-prototype wrapper', () => {
      const tagged = markError('x');
      expect(Object.isFrozen(tagged)).toBe(true);
      expect(Object.getPrototypeOf(tagged)).toBeNull();
    });

    it('should not recognize untagged values', () => {
      for (const value of ['msg', 0, null, undefined, {}, [], new Error('x')]) {
        expect(isError(value)).toBe(false);
      }
    });

    it('should expose the functions as static members of Bigodin', () => {
      expect(Bigodin.markError).toBe(markError);
      expect(Bigodin.isError).toBe(isError);
      expect(Bigodin.unwrapError).toBe(unwrapError);
    });

    it('should render as an empty string', async () => {
      const templ = withFail().compile('a{{fail}}b{{fail "truthy"}}c');
      expect(await templ()).toEqual('abc');
    });

    it('should render as empty inside arrays', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('list', () => [1, markError('x'), [markError(2), 3]]);
      expect(await bigodin.compile('{{list}}')()).toEqual('1,,,3');
    });

    it('should be falsy for if blocks', async () => {
      const templ = withFail().compile('{{#if (fail "truthy")}}yes{{else}}no{{/if}}');
      expect(await templ()).toEqual('no');
    });

    it('should be falsy for unless blocks', async () => {
      const templ = withFail().compile('{{#unless (fail "truthy")}}yes{{else}}no{{/unless}}');
      expect(await templ()).toEqual('yes');
    });

    it('should be falsy for negated blocks', async () => {
      const templ = withFail().compile('{{^fail "truthy"}}yes{{/fail}}');
      expect(await templ()).toEqual('yes');
    });

    it('should be falsy for each blocks', async () => {
      const templ = withFail().compile('{{#each (fail "truthy")}}item{{else}}empty{{/each}}');
      expect(await templ()).toEqual('empty');
    });

    it('should be falsy for with blocks', async () => {
      const templ = withFail().compile('{{#with (fail "truthy")}}in{{else}}out{{/with}}');
      expect(await templ()).toEqual('out');
    });

    it('should be falsy for custom block helpers', async () => {
      const templ = withFail().compile('{{#fail "truthy"}}yes{{else}}no{{/fail}}');
      expect(await templ()).toEqual('no');
    });

    it('should be falsy for the if and unless helpers', async () => {
      const templ = withFail().compile('{{if (fail "truthy")}} {{unless (fail "truthy")}}');
      expect(await templ()).toEqual('false true');
    });

    it('should be falsy when stored in a variable', async () => {
      const templ = withFail().compile('{{= $e (fail "truthy")}}{{#if $e}}yes{{else}}no{{/if}}');
      expect(await templ()).toEqual('no');
    });

    it('should pass the tagged value through to external helpers', async () => {
      const bigodin = withFail();
      bigodin.addHelper('fallback', (value: unknown, alt: unknown) =>
        isError(value) ? `${alt}:${String(unwrapError(value))}` : value,
      );
      const templ = bigodin.compile('{{fallback (fail "oops") "alt"}} {{fallback "ok" "alt"}}');
      expect(await templ()).toEqual('alt:oops ok');
    });

    it('should not expose the tag or wrapped value to templates', async () => {
      const templ = withFail().compile(
        '{{= $e (fail "secret")}}[{{#each $e}}{{$this}}{{/each}}{{#with $e}}{{value}}{{/with}}]',
      );
      expect(await templ()).toEqual('[]');
    });
  });
});
