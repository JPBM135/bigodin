import { describe, it, expect } from 'vitest';
import { $literal } from '../../src/parser/literal';

function lengthOf(value: unknown) {
  if (value === void 0) return 9;
  return JSON.stringify(value).length;
}

const li = (value: unknown, length?: number) => ({
  type: 'LITERAL',
  loc: { start: 0, end: length ?? lengthOf(value) },
  value,
});

describe('parser', () => {
  describe('literal', () => {
    it('should parse null', () => {
      const result = $literal.parse('null');
      expect(result).toEqual(li(null));
    });

    it('should parse undefined', () => {
      const result = $literal.parse('undefined');
      expect(result).toEqual(li(void 0));
    });

    it('should parse boolean', () => {
      expect($literal.parse('true')).toEqual(li(true));
      expect($literal.parse('false')).toEqual(li(false));
    });

    it('should parse number', () => {
      expect($literal.parse('0')).toEqual(li(0));
      expect($literal.parse('1')).toEqual(li(1));
      expect($literal.parse('-1')).toEqual(li(-1));
      expect($literal.parse('1.1')).toEqual(li(1.1));
      expect($literal.parse('-1.1')).toEqual(li(-1.1));
    });

    it('should parse string', () => {
      expect($literal.parse('"foo"')).toEqual(li('foo'));
      expect($literal.parse('"foo bar"')).toEqual(li('foo bar'));
      expect($literal.parse('"foo\\"bar"')).toEqual(li('foo"bar'));
      expect($literal.parse('"foo\\\\"')).toEqual(li('foo\\'));
      expect($literal.parse('"foo\\nbar"')).toEqual(li('foo\nbar'));
      expect($literal.parse('"foo\\tbar"')).toEqual(li('foo\tbar'));
      expect($literal.parse('"\\foo bar"')).toEqual(li('foo bar', 10));
    });

    it('should parse strings with single quotes and grave accents', () => {
      expect($literal.parse(`'foo'`)).toEqual(li('foo'));
      expect($literal.parse(`'foo\\'bar'`)).toEqual(li(`foo'bar`, 10));
      expect($literal.parse(`"foo'bar"`)).toEqual(li(`foo'bar`, 9));
      expect($literal.parse('`foo`')).toEqual(li('foo'));
      expect($literal.parse('`foo\\`bar`')).toEqual(li('foo`bar', 10));
    });

    it('should fail for non-literals', () => {
      expect(() => $literal.parse('foo')).toThrow();
      expect(() => $literal.parse('.')).toThrow();
    });
  });
});
