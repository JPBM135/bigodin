import { describe, it, expect } from 'vitest';
import { $expression } from '../../src/parser/expression';

const parse = (code: string) => $expression.parse(code + '}}');

describe('parser', () => {
  describe('path aliases', () => {
    it('rewrites bare `this` to `$this`', () => {
      expect(parse('this')).toMatchObject({
        type: 'EXPRESSION',
        path: '$this',
        params: [],
      });
    });

    it('rewrites `this.foo` to `$this.foo`', () => {
      expect(parse('this.foo')).toMatchObject({
        type: 'EXPRESSION',
        path: '$this.foo',
        params: [],
      });
    });

    it('rewrites `@root` to `$root`', () => {
      expect(parse('@root')).toMatchObject({
        type: 'EXPRESSION',
        path: '$root',
        params: [],
      });
    });

    it('rewrites `@root.foo.bar` to `$root.foo.bar`', () => {
      expect(parse('@root.foo.bar')).toMatchObject({
        type: 'EXPRESSION',
        path: '$root.foo.bar',
        params: [],
      });
    });

    it('rewrites `../foo` to `$parent.foo`', () => {
      expect(parse('../foo')).toMatchObject({
        type: 'EXPRESSION',
        path: '$parent.foo',
        params: [],
      });
    });

    it('rewrites `../../foo.bar` to `$parent.$parent.foo.bar`', () => {
      expect(parse('../../foo.bar')).toMatchObject({
        type: 'EXPRESSION',
        path: '$parent.$parent.foo.bar',
        params: [],
      });
    });

    it('rewrites `../` followed by `this` to `$parent.$this`', () => {
      expect(parse('../this')).toMatchObject({
        type: 'EXPRESSION',
        path: '$parent.$this',
      });
    });

    it('preserves `@index`/`@key`/`@first`/`@last` for runtime resolution', () => {
      expect(parse('@index')).toMatchObject({ path: '@index' });
      expect(parse('@key')).toMatchObject({ path: '@key' });
      expect(parse('@first')).toMatchObject({ path: '@first' });
      expect(parse('@last')).toMatchObject({ path: '@last' });
    });

    it('parses `@index` as a helper parameter', () => {
      expect(parse('show @index')).toMatchObject({
        type: 'EXPRESSION',
        path: 'show',
        params: [{ type: 'EXPRESSION', path: '@index', params: [] }],
      });
    });

    it('parses path aliases as helper parameters', () => {
      expect(parse('show ../foo @root.bar this.baz')).toMatchObject({
        type: 'EXPRESSION',
        path: 'show',
        params: [{ path: '$parent.foo' }, { path: '$root.bar' }, { path: '$this.baz' }],
      });
    });
  });
});
