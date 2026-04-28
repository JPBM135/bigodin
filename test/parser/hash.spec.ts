import { describe, it, expect } from 'vitest';
import { $expression } from '../../src/parser/expression';

const parse = (code: string) => $expression.parse(code + '}}');

describe('parser', () => {
  describe('hash arguments', () => {
    it('parses a single hash argument', () => {
      const ast = parse('helper key=1') as any;
      expect(ast.type).toEqual('EXPRESSION');
      expect(ast.path).toEqual('helper');
      expect(ast.params).toEqual([]);
      expect(ast.hash).toBeDefined();
      expect(ast.hash.key).toMatchObject({ type: 'LITERAL', value: 1 });
    });

    it('parses positional and hash arguments together', () => {
      const ast = parse('helper a "b" key=1 flag=true') as any;
      expect(ast.path).toEqual('helper');
      expect(ast.params).toHaveLength(2);
      expect(ast.params[0]).toMatchObject({ type: 'EXPRESSION', path: 'a' });
      expect(ast.params[1]).toMatchObject({ type: 'LITERAL', value: 'b' });
      expect(ast.hash.key).toMatchObject({ type: 'LITERAL', value: 1 });
      expect(ast.hash.flag).toMatchObject({ type: 'LITERAL', value: true });
    });

    it('parses path values in hash', () => {
      const ast = parse('helper k=foo.bar') as any;
      expect(ast.hash.k).toMatchObject({ type: 'EXPRESSION', path: 'foo.bar' });
    });

    it('parses variable values in hash', () => {
      const ast = parse('helper k=$myVar') as any;
      expect(ast.hash.k).toMatchObject({ type: 'VARIABLE', name: '$myVar' });
    });

    it('parses subexpression values in hash', () => {
      const ast = parse('helper k=(other 1)') as any;
      expect(ast.hash.k).toMatchObject({
        type: 'EXPRESSION',
        path: 'other',
        params: [{ type: 'LITERAL', value: 1 }],
      });
    });

    it('parses hash arguments inside subexpressions', () => {
      const ast = parse('outer (inner k=1)') as any;
      expect(ast.path).toEqual('outer');
      expect(ast.hash).toBeUndefined();
      expect(ast.params[0]).toMatchObject({ type: 'EXPRESSION', path: 'inner' });
      expect(ast.params[0].hash.k).toMatchObject({ type: 'LITERAL', value: 1 });
    });

    it('omits hash field when no hash arguments are present', () => {
      const ast = parse('helper a b') as any;
      expect(ast.hash).toBeUndefined();
    });

    it('rejects positional after hash', () => {
      expect(() => parse('helper k=1 oops')).toThrow(
        /positional parameters cannot follow hash arguments/i,
      );
    });

    it('rejects positional subexpression after hash', () => {
      expect(() => parse('helper k=1 (foo)')).toThrow(
        /positional parameters cannot follow hash arguments/i,
      );
    });

    it('rejects duplicate hash keys', () => {
      expect(() => parse('helper k=1 k=2')).toThrow(/duplicate hash key 'k'/i);
    });

    it('rejects hash key without value at end of expression', () => {
      expect(() => parse('helper k=')).toThrow(/hash argument 'k' is missing a value/i);
    });

    it('rejects hash key without value at end of subexpression', () => {
      expect(() => parse('outer (inner k=)')).toThrow(/hash argument 'k' is missing a value/i);
    });
  });
});
