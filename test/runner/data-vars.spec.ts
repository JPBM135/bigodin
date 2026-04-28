import { describe, it, expect } from 'vitest';
import Bigodin, { compile } from '../../src';
import { Execution } from '../../src/runner/execution';

describe('runner', () => {
  describe('@-data variables', () => {
    it('exposes @index in {{#each}}', async () => {
      const templ = compile('{{#items}}({{@index}}){{/items}}');
      expect(await templ({ items: ['a', 'b', 'c'] })).toEqual('(0)(1)(2)');
    });

    it('exposes @key as the array index', async () => {
      const templ = compile('{{#items}}{{@key}}={{$this}};{{/items}}');
      expect(await templ({ items: ['a', 'b'] })).toEqual('0=a;1=b;');
    });

    it('exposes @first and @last', async () => {
      const templ = compile(
        '{{#items}}{{#if @first}}[{{/if}}{{$this}}{{#if @last}}]{{/if}}{{/items}}',
      );
      expect(await templ({ items: ['x', 'y', 'z'] })).toEqual('[xyz]');
    });

    it('returns undefined for @data outside iteration', async () => {
      const templ = compile('<{{@index}}>');
      expect(await templ({})).toEqual('<>');
    });

    it('inner each shadows outer @index', async () => {
      const templ = compile('{{#outer}}{{#inner}}{{@index}}{{/inner}}|{{/outer}}');
      expect(
        await templ({
          outer: [{ inner: ['a', 'b'] }, { inner: ['c'] }],
        }),
      ).toEqual('01|0|');
    });

    it('returns undefined for unknown @data names', async () => {
      const templ = compile('{{#items}}<{{@unknown}}>{{/items}}');
      expect(await templ({ items: [1] })).toEqual('<>');
    });
  });

  describe('Handlebars-style path access', () => {
    it('resolves ../foo to the parent context', async () => {
      const templ = compile('{{#items}}{{../outer}}-{{/items}}');
      expect(
        await templ({
          outer: 'P',
          items: [{ x: 1 }, { x: 2 }],
        }),
      ).toEqual('P-P-');
    });

    it('resolves ../../foo through multiple parents', async () => {
      const templ = compile('{{#a}}{{#b}}{{../../top}}{{/b}}{{/a}}');
      expect(
        await templ({
          top: 'T',
          a: { b: { whatever: true } },
        }),
      ).toEqual('T');
    });

    it('resolves @root.foo from a deeply nested block', async () => {
      const templ = compile('{{#items}}{{#more}}{{@root.label}}-{{/more}}{{/items}}');
      expect(
        await templ({
          label: 'L',
          items: [{ more: [1, 2] }],
        }),
      ).toEqual('L-L-');
    });

    it('resolves bare `this` to the current context', async () => {
      const templ = compile('{{#items}}({{this}}){{/items}}');
      expect(await templ({ items: ['x', 'y'] })).toEqual('(x)(y)');
    });

    it('resolves `this.field` to a current-context property', async () => {
      const templ = compile('{{#items}}{{this.name}}|{{/items}}');
      expect(await templ({ items: [{ name: 'a' }, { name: 'b' }] })).toEqual('a|b|');
    });
  });

  describe('Execution data frames', () => {
    it('returns undefined when getDataVar is called with no frames', () => {
      const execution = Execution.of({});
      expect(execution.getDataVar('index')).toBeUndefined();
    });

    it('exposes pushed frame values and clears them on pop', () => {
      const execution = Execution.of({});
      execution.pushDataFrame({ index: 5, first: false });
      expect(execution.getDataVar('index')).toEqual(5);
      expect(execution.getDataVar('first')).toEqual(false);
      expect(execution.getDataVar('missing')).toBeUndefined();
      execution.popDataFrame();
      expect(execution.getDataVar('index')).toBeUndefined();
    });
  });

  describe('hash arguments', () => {
    it('passes a hash object as the last helper argument', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('describe', (...args: unknown[]) => JSON.stringify(args));
      const templ = bigodin.compile('{{describe "x" key=1 flag=true}}');
      expect(await templ()).toEqual('["x",{"key":1,"flag":true}]');
    });

    it('does not pass any extra argument when no hash is present', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('count', (...args: unknown[]) => String(args.length));
      const templ = bigodin.compile('{{count "a" "b"}}');
      expect(await templ()).toEqual('2');
    });

    it('evaluates hash subexpression values', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('upper', (str: unknown) => String(str).toUpperCase());
      bigodin.addHelper('describe', (opts: { v?: unknown }) => String(opts.v));
      const templ = bigodin.compile('{{describe v=(upper name)}}');
      expect(await templ({ name: 'foo' })).toEqual('FOO');
    });

    it('evaluates hash path values from current context', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('describe', (opts: { v?: unknown }) => String(opts.v));
      const templ = bigodin.compile('{{describe v=name}}');
      expect(await templ({ name: 'bar' })).toEqual('bar');
    });

    it('rejects unsafe hash keys at runtime', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('describe', String);
      // The parser permits __proto__ as a hash key, but the runtime
      // refuses to materialize a hash with that key on the helper call.
      const templ = bigodin.compile('{{describe __proto__=1}}');
      await expect(templ()).rejects.toThrow(/hash key __proto__ not allowed/i);
    });
  });
});
