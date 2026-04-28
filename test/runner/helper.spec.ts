import { describe, it, expect } from 'vitest';
import Bigodin, { compile } from '../../src';

describe('runner', () => {
  describe('helper', () => {
    it('should execute helpers', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('upper', (str: unknown) => String(str).toUpperCase());
      const templ = bigodin.compile('Hello, {{upper name }} {{upper "Schmidt" }}!');
      const result = await templ({ name: 'George' });
      expect(result).toEqual('Hello, GEORGE SCHMIDT!');
    });

    it('should execute nested helpers', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('upper', (str: unknown) => String(str).toUpperCase());
      bigodin.addHelper('append', (a: unknown, b: unknown) => String(a) + String(b));
      const templ = bigodin.compile('Hello, {{upper (append name " schmidt") }}!');
      const result = await templ({ name: 'George' });
      expect(result).toEqual('Hello, GEORGE SCHMIDT!');
    });

    it('should execute parameterless helpers', async () => {
      const templ = compile('{{if}}');
      const result = await templ({ if: 'wrong' });
      expect(result).toEqual('false');
    });

    it('should execute parameterless extra helpers', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('foo', () => 'bar');
      const templ = bigodin.compile('{{foo}}');
      const result = await templ({ foo: 'wrong' });
      expect(result).toEqual('bar');
    });

    it('should not execute non existing helpers', async () => {
      const templ = compile('Hello, {{non-existing name }}!');
      const result = templ({ name: 'George' });
      await expect(result).rejects.toThrow(/helper non-existing not found/i);
    });

    it('should not execute default helpers when disabled', async () => {
      const templ = compile('{{#if name}}yes{{else}}no{{/if}}');
      const result = templ({ name: 'George' }, { allowDefaultHelpers: false });
      await expect(result).rejects.toThrow(/helper if not found/i);
    });

    it('should allow default helpers when enabled', async () => {
      const templ = compile('{{#if name}}yes{{else}}no{{/if}}');
      const result = await templ({ name: 'George' }, { allowDefaultHelpers: true });
      expect(result).toEqual('yes');

      const templ2 = compile('{{#if name}}yes{{else}}no{{/if}}');
      const result2 = await templ2({ name: 'George' }, { allowDefaultHelpers: null as any });
      expect(result2).toEqual('yes');
    });

    it('should not allow unsafe keys as helper names', async () => {
      const templ = compile('Hello, {{__proto__ "Schmidt" }}!');
      await expect(templ()).rejects.toThrow(/helper __proto__ not allowed/i);
    });

    it('should run extra helpers', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('add', (a: number, b: number) => a + b);
      const templ = bigodin.compile('{{add 1 2}}');
      const result = await templ(bigodin as any);
      expect(result).toEqual('3');
    });

    it('should prioritize extra helpers', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('upper', () => 5);
      const templ = bigodin.compile('{{upper "hello"}}');
      const result = await templ(bigodin as any);
      expect(result).toEqual('5');
    });

    it('should preserve helper response types', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('add', (a: number, b: number) => a + b);
      const templ = bigodin.compile('{{add (add 1 2) 4}}');
      const result = await templ(bigodin as any);
      expect(result).toEqual('7');
    });

    it('should run async helpers in series', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper(
        'wait',
        async (time: number) =>
          new Promise((resolve) => {
            setTimeout(resolve, time);
          }),
      );
      const templ = bigodin.compile('{{wait 200}}{{wait 300}}');
      const start = Date.now();
      await templ(bigodin as any);
      const deltaT = Date.now() - start;
      expect(deltaT).toBeGreaterThanOrEqual(490);
      expect(deltaT).toBeLessThanOrEqual(590);
    });

    it('should pass execution to helpers', async () => {
      const bigodin = new Bigodin();
      // eslint-disable-next-line func-names
      bigodin.addHelper('setTitle', function (this: any, title: string) {
        this.data.title = title;
      });

      const templ = bigodin.compile('{{setTitle "Hello"}}');

      const data: any = {};
      await templ(bigodin as any, { data });
      expect(data.title).toEqual('Hello');
    });

    it('should log helper and location on error', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('fail', () => {
        throw new Error('fail');
      });

      const templ = bigodin.compile('{{fail}}');
      await expect(templ(bigodin as any)).rejects.toThrow('Error at helper fail, position 2: fail');
    });

    it('should wrap non-Error throws into an Error', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('failPlain', () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'plain string failure';
      });

      const templ = bigodin.compile('{{failPlain}}');
      await expect(templ()).rejects.toThrow(
        'Error at helper failPlain, position 2: plain string failure',
      );
    });

    it('should log helper when no location on error', async () => {
      const bigodin = new Bigodin();
      bigodin.addHelper('fail', () => {
        throw new Error('fail');
      });

      const ast = {
        type: 'TEMPLATE',
        version: 2,
        statements: [
          {
            type: 'MUSTACHE',
            expression: {
              type: 'EXPRESSION',
              path: 'fail',
              params: [],
            },
          },
        ],
      };

      await expect(bigodin.run(ast as any, bigodin as any)).rejects.toThrow(
        'Error at helper fail: fail',
      );
    });
  });
});
