import { describe, it, expect } from 'vitest';
import Bigodin, { compile } from '../../src';

describe('runner', () => {
  describe('blocks', () => {
    it('should return statements with truthy value', async () => {
      const templ = compile('{{#val}}foo{{/val}}');
      expect(await templ({ val: true })).toEqual('foo');
      expect(await templ({ val: 'a' })).toEqual('foo');
      expect(await templ({ val: {} })).toEqual('foo');
      expect(await templ({ val: 1 })).toEqual('foo');
    });

    it('should ignore statements with falsy value', async () => {
      const templ = compile('{{#val}}foo{{/val}}');
      expect(await templ({ val: false })).toEqual('');
      expect(await templ({ val: null })).toEqual('');
      expect(await templ({ val: '' })).toEqual('');
      expect(await templ({ val: [] })).toEqual('');
      expect(await templ({ val: 0 })).toEqual('');
      expect(await templ()).toEqual('');
    });

    it('should run else block with falsy value', async () => {
      const templ = compile('{{#val}}foo{{else}}bar{{/val}}');
      expect(await templ({ val: false })).toEqual('bar');
    });

    it('should not run else block with truthy value', async () => {
      const templ = compile('{{#val}}foo{{else}}bar{{/val}}');
      expect(await templ({ val: true })).toEqual('foo');
    });

    it('should run else block with empty arrays', async () => {
      const templ = compile('{{#val}}foo{{else}}bar{{/val}}');
      expect(await templ({ val: [] })).toEqual('bar');
    });

    it('should not run else block with non-empty arrays', async () => {
      const templ = compile('{{#val}}foo{{else}}bar{{/val}}');
      expect(await templ({ val: [1] })).toEqual('foo');
    });

    it('should run statements N times with array', async () => {
      const templ = compile('{{#val}}foo{{/val}}');
      expect(await templ({ val: [1, 2, 3] })).toEqual('foofoofoo');
    });

    it('should pass parent context when non-object value', async () => {
      const templ = compile('{{#val}}{{foo}}{{/val}}');
      expect(await templ({ val: true, foo: 'bar' })).toEqual('bar');
      expect(await templ({ val: 'a', foo: 'bar' })).toEqual('bar');
      expect(await templ({ val: 1, foo: 'bar' })).toEqual('bar');
    });

    it('should pass object as context', async () => {
      const templ = compile('{{#val}}{{foo}}{{/val}}');
      expect(await templ({ val: { foo: 'bar' }, foo: 'wrong' })).toEqual('bar');
    });

    it('should pass array object items as context', async () => {
      const templ = compile('{{#val}}{{foo}}{{/val}}');
      expect(await templ({ val: [{ foo: 'bar' }, { foo: 'baz' }], foo: 'wrong' })).toEqual(
        'barbaz',
      );
    });

    it('should not pass parent context for array items', async () => {
      const templ = compile('{{#val}}{{foo}}{{/val}}');
      expect(await templ({ val: [true, 'a', 1, null, []], foo: 'bar' })).toEqual('');
    });

    it('should let access current object with $this', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('stringify', (v: unknown) => JSON.stringify(v));
      const templ = bigodin.compile('{{#val}}{{stringify $this}}{{/val}}');
      expect(await templ({ val: { foo: 'bar' } })).toEqual('{"foo":"bar"}');
    });

    it('should let access current array item with $this', async () => {
      const templ = compile('{{#arr}}({{$this}}){{/arr}}');
      expect(await templ({ arr: [1, 2, 3] })).toEqual('(1)(2)(3)');
    });

    it('should let access $root for one level', async () => {
      const templ = compile('{{#val}}{{foo}} {{$root.foo}}{{/val}}');
      expect(await templ({ val: { foo: 'inside' }, foo: 'outside' })).toEqual('inside outside');
    });

    it('should let access $root for two levels', async () => {
      const templ = compile('{{#val}}{{#other}}{{foo}} {{$root.foo}}{{/other}}{{/val}}');
      expect(
        await templ({ val: { other: { foo: 'inside' }, foo: 'middle' }, foo: 'outside' }),
      ).toEqual('inside outside');
    });

    it('should let access $parent for one level', async () => {
      const templ = compile('{{#val}}{{foo}} {{$parent.foo}}{{/val}}');
      expect(await templ({ val: { foo: 'inside' }, foo: 'outside' })).toEqual('inside outside');
    });

    it('should let access $parent for two levels', async () => {
      const templ = compile(
        '{{#val}}{{#other}}{{foo}} {{$parent.foo}} {{$parent.$parent.foo}}{{/other}}{{/val}}',
      );
      expect(
        await templ({ val: { other: { foo: 'inside' }, foo: 'middle' }, foo: 'outside' }),
      ).toEqual('inside middle outside');
    });

    it('should run else block with parent context', async () => {
      const templ = compile('{{#val}}nah{{else}}{{foo}}{{/val}}');
      expect(await templ({ val: false, foo: 'bar' })).toEqual('bar');
    });

    it('should run negated blocks', async () => {
      const templ = compile('{{^val}}foo{{/val}}');
      expect(await templ({ val: false })).toEqual('foo');
      expect(await templ({ val: '' })).toEqual('foo');
      expect(await templ({ val: true })).toEqual('');
      expect(await templ({ val: 'a' })).toEqual('');
    });

    it('should run else of negated blocks', async () => {
      const templ = compile('{{^val}}foo{{else}}bar{{/val}}');
      expect(await templ({ val: true })).toEqual('bar');
    });

    it('should run else of negated blocks with parent context', async () => {
      const templ = compile('{{^val}}foo{{else}}{{foo}}{{/val}}');
      expect(await templ({ val: { foo: 'wrong' }, foo: 'bar' })).toEqual('bar');
    });

    it('should run negated blocks with parent context always', async () => {
      const templ = compile('{{^val}}{{foo}}{{/val}}');
      expect(await templ({ val: false, foo: 'bar' })).toEqual('bar');
    });

    it('should accept helper returns as value', async () => {
      const bigodin = new Bigodin();

      bigodin.addHelper(
        'foo',
        async (val: unknown) =>
          new Promise((resolve) => {
            // eslint-disable-next-line @typescript-eslint/no-implied-eval
            setTimeout((resolve as any)({ val }), 50);
          }),
      );

      const templ = bigodin.compile('{{#foo "bar"}}{{val}}{{/foo}}');
      expect(await templ()).toEqual('bar');
    });

    it('should nest correctly', async () => {
      const templ = compile('{{#a}}{{#b}}{{c}}{{/b}}{{/a}}');
      // eslint-disable-next-line id-length
      expect(await templ({ a: { b: { c: 'foo' } } })).toEqual('foo');
    });

    it('should parse complex templates with mustaches, blocks, and so on', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('upper', (str: unknown) => String(str).toUpperCase());
      const templ = bigodin.compile(`
{
"id": {{id}},
"code": "{{upper code}}",
{{#name}}
"name": "{{name}}",
{{/name}}
"items": [
  {{#items}}
    "{{name}}"{{^isLast}},{{/isLast}}
  {{/items}}
]
}
      `);
      const a = await templ({
        id: 1,
        code: 'foo',
        name: 'bar',
        items: [{ name: 'baz' }, { name: 'qux', isLast: true }],
      });
      expect(JSON.parse(a)).toEqual({
        id: 1,
        code: 'FOO',
        name: 'bar',
        items: ['baz', 'qux'],
      });

      const b = await templ({
        id: 1,
        code: 'foo',
        items: [],
      });
      expect(JSON.parse(b)).toEqual({
        id: 1,
        code: 'FOO',
        items: [],
      });
    });
  });
});
