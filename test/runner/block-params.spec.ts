import { describe, it, expect } from 'vitest';
import { compile, parse } from '../../src';
import { Execution } from '../../src/runner/execution';

describe('runner', () => {
  describe('block params (as |a b|)', () => {
    describe('each', () => {
      it('binds the element and index', async () => {
        const templ = compile('{{#each xs as |item idx|}}{{idx}}:{{item}};{{/each}}');
        expect(await templ({ xs: ['a', 'b'] })).toEqual('0:a;1:b;');
      });

      it('lets a block param shadow a same-named context key', async () => {
        const templ = compile('{{#each xs as |item|}}{{item}}{{/each}}');
        expect(await templ({ xs: ['a', 'b'], item: 'ctx' })).toEqual('ab');
      });

      it('binds undefined for params with no corresponding value', async () => {
        const templ = compile('{{#each xs as |item idx extra|}}[{{extra}}]{{/each}}');
        expect(await templ({ xs: ['a'] })).toEqual('[]');
      });

      it('supports dotted access through a block param', async () => {
        const templ = compile('{{#each xs as |row|}}{{row.num}};{{/each}}');
        expect(await templ({ xs: [{ num: 1 }, { num: 2 }] })).toEqual('1;2;');
      });

      it('shadows per nesting level', async () => {
        const templ = compile(
          '{{#each rows as |row r|}}{{#each row as |cell c|}}{{r}}{{c}}:{{cell}};{{/each}}{{/each}}',
        );
        expect(await templ({ rows: [['a', 'b'], ['c']] })).toEqual('00:a;01:b;10:c;');
      });
    });

    describe('with', () => {
      it('binds the context object', async () => {
        const templ = compile('{{#with user as |u|}}{{u.name}}{{/with}}');
        expect(await templ({ user: { name: 'Al' } })).toEqual('Al');
      });

      it('binds each frame of a multi-argument with', async () => {
        const templ = compile('{{#with a b as |x y|}}{{x.v}}-{{y.v}}{{/with}}');
        expect(await templ({ a: { v: 1 }, b: { v: 2 } })).toEqual('1-2');
      });
    });

    describe('object and scalar sections', () => {
      it('binds the object for an object section', async () => {
        const templ = compile('{{#user as |u|}}{{u.name}}{{/user}}');
        expect(await templ({ user: { name: 'Al' } })).toEqual('Al');
      });

      it('binds the scalar for a truthy scalar section', async () => {
        const templ = compile('{{#name as |n|}}{{n}}{{/name}}');
        expect(await templ({ name: 'X' })).toEqual('X');
      });
    });

    describe('precedence', () => {
      it('does not shadow @-data variables', async () => {
        const templ = compile('{{#each xs as |item|}}{{@index}}{{/each}}');
        expect(await templ({ xs: ['a', 'b'] })).toEqual('01');
      });

      it('does not shadow $root', async () => {
        const templ = compile('{{#each xs as |top|}}{{$root.top}}{{/each}}');
        expect(await templ({ top: 'R', xs: [1] })).toEqual('R');
      });

      it('does not shadow $parent', async () => {
        const templ = compile('{{#each xs as |label|}}{{$parent.label}}{{/each}}');
        expect(await templ({ label: 'L', xs: [1, 2] })).toEqual('LL');
      });

      it('falls back to context when the leading segment is not a param', async () => {
        const templ = compile('{{#each xs as |item|}}{{other}}{{/each}}');
        expect(await templ({ xs: [{ other: 'O' }] })).toEqual('O');
      });
    });

    describe('parsing', () => {
      it('still parses a bare `as` helper argument (no bar)', async () => {
        const templ = compile('{{#each xs}}{{this}}{{/each}}');
        expect(await templ({ xs: [1] })).toEqual('1');
      });

      it('records blockParams on the AST', () => {
        const ast = parse('{{#each xs as |item idx|}}{{/each}}');
        const block = ast.statements.find((stmt) => stmt.type === 'BLOCK') as any;
        expect(block.blockParams).toEqual(['item', 'idx']);
      });

      it('omits blockParams when the clause is absent', () => {
        const ast = parse('{{#each xs}}{{/each}}');
        const block = ast.statements.find((stmt) => stmt.type === 'BLOCK') as any;
        expect('blockParams' in block).toEqual(false);
      });

      it('tolerates extra whitespace inside the bars', () => {
        const ast = parse('{{#each xs as |  item   idx  |}}{{/each}}');
        const block = ast.statements.find((stmt) => stmt.type === 'BLOCK') as any;
        expect(block.blockParams).toEqual(['item', 'idx']);
      });
    });

    describe('Execution param frames', () => {
      it('resolves params innermost-first and reports found', () => {
        const execution = Execution.of({});
        execution.pushParamFrame(['a', 'b'], [1, 2]);
        execution.pushParamFrame(['a'], [9]);
        expect(execution.getParam('a')).toEqual({ found: true, value: 9 });
        expect(execution.getParam('b')).toEqual({ found: true, value: 2 });
        expect(execution.getParam('missing')).toEqual({ found: false, value: undefined });
        execution.popParamFrame();
        expect(execution.getParam('a')).toEqual({ found: true, value: 1 });
      });

      it('reports a param bound to undefined as found', () => {
        const execution = Execution.of({});
        execution.pushParamFrame(['a', 'b'], [1]);
        expect(execution.getParam('b')).toEqual({ found: true, value: undefined });
      });
    });
  });
});
