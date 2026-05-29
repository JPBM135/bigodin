import { describe, it, expect } from 'vitest';
import { compile, parse } from '../../src';

describe('parser', () => {
  describe('whitespace control (~)', () => {
    describe('interpolation', () => {
      it('trims the preceding text with {{~x}}', async () => {
        expect(await compile('a  {{~x}}  b')({ x: 'X' })).toEqual('aX  b');
      });

      it('trims the following text with {{x~}}', async () => {
        expect(await compile('a  {{x~}}  b')({ x: 'X' })).toEqual('a  Xb');
      });

      it('trims both sides with {{~x~}}', async () => {
        expect(await compile('a  {{~x~}}  b')({ x: 'X' })).toEqual('aXb');
      });

      it('is a no-op when there is no neighbouring text', async () => {
        expect(await compile('{{~x~}}')({ x: 'X' })).toEqual('X');
      });

      it('trims greedily across blank lines', async () => {
        expect(await compile('a\n\n  {{~x~}}\n\n b')({ x: 'X' })).toEqual('aXb');
      });
    });

    describe('raw forms', () => {
      it('trims around a triple mustache {{~{x}~}}', async () => {
        expect(await compile('a  {{~{x}~}}  b')({ x: '<i>' })).toEqual('a<i>b');
      });

      it('trims only the left of a triple mustache {{~{x}}}', async () => {
        expect(await compile('a  {{~{x}}}  b')({ x: 'X' })).toEqual('aX  b');
      });

      it('trims only the right of a triple mustache {{{x}~}}', async () => {
        expect(await compile('a  {{{x}~}}  b')({ x: 'X' })).toEqual('a  Xb');
      });

      it('trims around an ampersand mustache {{~&x~}}', async () => {
        expect(await compile('a  {{~&x~}}  b')({ x: 'X' })).toEqual('aXb');
      });
    });

    describe('comments', () => {
      it('trims both sides and lifts the trailing ~ out of the value', async () => {
        expect(await compile('a  {{~! c ~}}  b')({})).toEqual('ab');
      });

      it('trims only the left when there is no trailing ~', async () => {
        expect(await compile('a  {{~! c }}  b')({})).toEqual('a  b');
      });

      it('trims only the right with {{! c ~}}', async () => {
        expect(await compile('a  {{! c ~}}  b')({})).toEqual('a  b');
      });
    });

    describe('assignments', () => {
      it('accepts a trailing ~ and trims the following text', async () => {
        expect(await compile('a  {{= $v "V" ~}}  {{$v}}')({})).toEqual('a  V');
      });

      it('still rejects a stray token that is not the ~ closer', async () => {
        expect(() => compile('{{= $v "V" junk}}')).toThrow(/single expression/);
      });
    });

    describe('blocks', () => {
      it('trims the left of an opener', async () => {
        expect(await compile('x  {{~#if a}}T{{/if}}')({ a: true })).toEqual('xT');
      });

      it('trims the right of an opener', async () => {
        expect(await compile('{{#if a~}}  T{{/if}}')({ a: true })).toEqual('T');
      });

      it('trims the left of a closer', async () => {
        expect(await compile('{{#if a}}T  {{~/if}}')({ a: true })).toEqual('T');
      });

      it('trims the right of a closer', async () => {
        expect(await compile('{{#if a}}T{{/if~}}  x')({ a: true })).toEqual('Tx');
      });

      it('trims all four sides at once', async () => {
        expect(await compile('a  {{~#if x~}}  body  {{~/if~}}  b')({ x: true })).toEqual('abodyb');
      });
    });

    describe('else', () => {
      it('trims the left of a simple else (if-branch tail)', async () => {
        expect(await compile('{{#if a}}T  {{~else}}F{{/if}}')({ a: true })).toEqual('T');
      });

      it('trims the right of a simple else (else-branch head)', async () => {
        expect(await compile('{{#if a}}T{{else~}}  F{{/if}}')({ a: false })).toEqual('F');
      });

      it('trims around an {{else if}} chain', async () => {
        expect(
          await compile('{{#if a}}A  {{~else if b~}}  B{{else}}C{{/if}}')({ a: false, b: true }),
        ).toEqual('B');
      });
    });

    describe('AST shape', () => {
      it('records no trim field when ~ is absent', () => {
        const ast = parse('{{x}}');
        const mustache = ast.statements.find((stmt) => stmt.type === 'MUSTACHE');
        expect(mustache && 'trim' in mustache).toEqual(false);
      });

      it('records left/right flags on a mustache', () => {
        const ast = parse('a {{~x~}} b');
        const mustache = ast.statements.find((stmt) => stmt.type === 'MUSTACHE') as any;
        expect(mustache.trim).toEqual({ left: true, right: true });
      });

      it('records per-tag flags on a block', () => {
        const ast = parse('{{~#if a~}}b{{~/if~}}');
        const block = ast.statements.find((stmt) => stmt.type === 'BLOCK') as any;
        expect(block.trim).toEqual({
          open: { left: true, right: true },
          close: { left: true, right: true },
        });
      });
    });
  });
});
