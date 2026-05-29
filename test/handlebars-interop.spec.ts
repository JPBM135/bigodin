import Handlebars from 'handlebars';
import { describe, it, expect } from 'vitest';
import Bigodin, { compile } from '../src';

/*
 * Handlebars compatibility suite. Each "parity" case renders the same template
 * through a real Handlebars build and through bigodin and asserts identical
 * output, so a drift in either engine is caught.
 *
 * Bigodin is a Handlebars-flavored superset, not a clone. Where it parts ways
 * on purpose, the difference is documented on the website (website/docs/...):
 * those cases live in `documented divergences` and assert bigodin's documented
 * behavior, citing the doc.
 */
async function expectParity(template: string, context: object): Promise<string> {
  const handlebarsOut = Handlebars.compile(template)(context);
  const bigodinOut = await compile(template)(context);
  expect(bigodinOut, `bigodin should match Handlebars for ${JSON.stringify(template)}`).toEqual(
    handlebarsOut,
  );
  return bigodinOut;
}

// Renders a template through both engines with the same helpers registered on
// each. Bigodin and Handlebars hand helpers their arguments differently
// (Handlebars appends an options object), so the registrar receives each raw
// engine and registers an implementation appropriate to it.
async function renderBoth(
  template: string,
  context: object,
  registerHandlebars: (hb: typeof Handlebars) => void,
  registerBigodin: (bg: Bigodin) => void,
): Promise<[string, string]> {
  const hb = Handlebars.create();
  registerHandlebars(hb);
  const bg = new Bigodin();
  registerBigodin(bg);
  return [hb.compile(template)(context), await bg.compile(template)(context)];
}

describe('Handlebars interop', () => {
  describe('interpolation and paths', () => {
    it('matches Handlebars for a simple value', async () => {
      await expectParity('Hello, {{name}}!', { name: 'Al' });
    });

    it('ignores insignificant whitespace inside the braces', async () => {
      await expectParity('{{ name }}|{{  name  }}', { name: 'Al' });
    });

    it('matches Handlebars for nested dot paths', async () => {
      await expectParity('{{a.b.deep}}', { a: { b: { deep: 'deep' } } });
    });

    it('matches Handlebars for a missing key', async () => {
      await expectParity('[{{missing}}]', {});
      await expectParity('[{{a.missing.x}}]', { a: {} });
    });

    it('matches Handlebars coercing scalars', async () => {
      await expectParity('{{num}}', { num: 0 });
      await expectParity('{{num}}', { num: 42 });
      await expectParity('{{num}}', { num: -3.5 });
      await expectParity('{{flag}}', { flag: true });
      await expectParity('{{flag}}', { flag: false });
      await expectParity('{{num}}', { num: null });
      await expectParity('{{num}}', {});
    });

    it('matches Handlebars rendering a plain object as [object Object]', async () => {
      await expectParity('{{obj}}', { obj: { a: 1 } });
    });

    it('matches Handlebars rendering an array (comma-joined)', async () => {
      await expectParity('{{arr}}', { arr: [1, 2, 3] });
      await expectParity('{{arr}}', { arr: ['a', 'b'] });
      await expectParity('{{arr}}', { arr: [] });
      await expectParity('{{arr}}', { arr: [1, [2, 3]] });
      await expectParity('{{arr}}', { arr: [null, 1] });
      await expectParity('{{arr}}', { arr: [{}, {}] });
    });
  });

  describe('raw output forms', () => {
    it('matches Handlebars for {{{x}}} and {{&x}} on non-HTML content', async () => {
      await expectParity('{{{x}}}', { x: 'plain' });
      await expectParity('{{&x}}', { x: 'plain' });
      await expectParity('{{x}}', { x: 'plain' });
    });

    it('matches Handlebars {{{x}}} for HTML content (both emit raw)', async () => {
      await expectParity('{{{html}}}', { html: '<b>&"\'' });
      await expectParity('{{&html}}', { html: '<b>&' });
    });
  });

  describe('comments', () => {
    it('matches Handlebars stripping a short comment', async () => {
      await expectParity('x{{! comment }}y', {});
    });

    it('matches Handlebars stripping a {{!-- --}} comment with no embedded tags', async () => {
      await expectParity('x{{!-- simple --}}y', {});
    });

    it('matches Handlebars stripping a standalone comment line', async () => {
      await expectParity('Hello\n  {{! a comment }}\nWorld', {});
    });

    it('matches Handlebars stripping a multi-line comment', async () => {
      await expectParity('a\n{{!\n  many\n  lines\n}}\nb', {});
    });
  });

  describe('implicit iterator and this', () => {
    it('matches Handlebars for {{.}} and {{this}} inside a section', async () => {
      await expectParity('{{#each xs}}{{.}}{{/each}}', { xs: ['a', 'b'] });
      await expectParity('{{#each xs}}{{this}}{{/each}}', { xs: ['a', 'b'] });
    });

    it('matches Handlebars for this.field', async () => {
      await expectParity('{{#each xs}}{{this.num}};{{/each}}', { xs: [{ num: 1 }, { num: 2 }] });
    });
  });

  describe('sections and inverted sections', () => {
    it('matches Handlebars entering an object section', async () => {
      await expectParity('{{#a}}{{b}}{{/a}}', { a: { b: 'B' } });
    });

    it('matches Handlebars iterating an array section', async () => {
      await expectParity('{{#a}}{{this}}{{/a}}', { a: ['x', 'y'] });
    });

    it('matches Handlebars iterating objects in an array section', async () => {
      await expectParity('{{#rows}}{{x}};{{/rows}}', { rows: [{ x: 1 }, { x: 2 }] });
    });

    it('matches Handlebars for nested sections with parent access', async () => {
      await expectParity('{{#a}}{{#b}}{{../label}}{{/b}}{{/a}}', {
        a: { label: 'A', b: { whatever: 1 } },
      });
    });

    it('matches Handlebars for inverted sections on empty/falsy values', async () => {
      await expectParity('{{^a}}none{{/a}}', { a: [] });
      await expectParity('{{^a}}none{{/a}}', { a: false });
      await expectParity('{{^a}}none{{/a}}', {});
    });

    it('matches Handlebars for an inverted section that does not run', async () => {
      await expectParity('{{^a}}none{{/a}}', { a: 'truthy' });
    });
  });

  describe('data variables', () => {
    it('matches Handlebars exposing @index, @first, @last and @key together', async () => {
      await expectParity(
        '{{#each xs}}{{@index}}/{{@key}}{{#if @first}}<{{/if}}{{#if @last}}>{{/if}};{{/each}}',
        { xs: ['a', 'b', 'c'] },
      );
    });

    it('matches Handlebars shadowing @index across nested loops', async () => {
      await expectParity('{{#each outer}}{{#each inner}}{{@index}}{{/each}}|{{/each}}', {
        outer: [{ inner: ['a', 'b'] }, { inner: ['c'] }],
      });
    });
  });

  describe('nested context walking', () => {
    it('matches Handlebars for ../../ through two parents', async () => {
      await expectParity('{{#a}}{{#b}}{{../../top}}{{/b}}{{/a}}', {
        top: 'T',
        a: { b: { whatever: true } },
      });
    });

    it('matches Handlebars resolving @root from deep inside loops', async () => {
      await expectParity('{{#each xs}}{{#each this}}{{@root.label}}{{this}};{{/each}}{{/each}}', {
        label: 'R',
        xs: [[1, 2], [3]],
      });
    });
  });

  describe('strict scoping (Handlebars-style, no auto context walk)', () => {
    it('matches Handlebars: a section does not see the parent scope implicitly', async () => {
      await expectParity('{{#outer}}{{top}}{{/outer}}', { top: 'T', outer: { x: 1 } });
    });

    it('matches Handlebars: an each body does not see the parent scope implicitly', async () => {
      await expectParity('{{#each xs}}{{top}}{{/each}}', { top: 'T', xs: [{}] });
    });

    it('matches Handlebars: @index outside a loop is empty', async () => {
      await expectParity('[{{@index}}]', {});
    });
  });

  describe('helpers, subexpressions and arguments', () => {
    const registerShout = {
      hb: (hb: typeof Handlebars) =>
        hb.registerHelper('shout', (value: unknown) => String(value).toUpperCase()),
      bg: (bg: Bigodin) => bg.addHelper('shout', (value: unknown) => String(value).toUpperCase()),
    };

    it('matches Handlebars calling a helper with a path argument', async () => {
      const [hb, bg] = await renderBoth(
        '{{shout name}}',
        { name: 'hi' },
        registerShout.hb,
        registerShout.bg,
      );
      expect(bg).toEqual(hb);
    });

    it('matches Handlebars calling a helper with a string literal', async () => {
      const [hb, bg] = await renderBoth(
        '{{shout "literal"}}',
        {},
        registerShout.hb,
        registerShout.bg,
      );
      expect(bg).toEqual(hb);
    });

    it('matches Handlebars for nested subexpressions', async () => {
      const [hb, bg] = await renderBoth(
        '{{shout (shout name)}}',
        { name: 'hi' },
        registerShout.hb,
        registerShout.bg,
      );
      expect(bg).toEqual(hb);
    });

    it('matches Handlebars for a helper returning a number', async () => {
      const reg = {
        hb: (hb: typeof Handlebars) => hb.registerHelper('inc', (value: number) => value + 1),
        bg: (bg: Bigodin) => bg.addHelper('inc', (value: number) => value + 1),
      };
      const [hb, bg] = await renderBoth('{{inc num}}', { num: 41 }, reg.hb, reg.bg);
      expect(bg).toEqual(hb);
    });

    it('matches Handlebars for a helper with multiple arguments', async () => {
      const reg = {
        hb: (hb: typeof Handlebars) =>
          hb.registerHelper('concat', (...args: unknown[]) => args.slice(0, -1).join('')),
        bg: (bg: Bigodin) => bg.addHelper('concat', (...args: unknown[]) => args.join('')),
      };
      const [hb, bg] = await renderBoth('{{concat a b "!"}}', { a: 'x', b: 'y' }, reg.hb, reg.bg);
      expect(bg).toEqual(hb);
    });

    it('matches Handlebars using a helper as a block head', async () => {
      const reg = {
        hb: (hb: typeof Handlebars) => hb.registerHelper('eq', (a: unknown, b: unknown) => a === b),
        bg: (bg: Bigodin) => bg.addHelper('eq', (a: unknown, b: unknown) => a === b),
      };
      const tpl =
        "{{#if (eq country 'BR')}}Brazil{{else if (eq country 'US')}}US{{else}}Other{{/if}}";
      for (const country of ['BR', 'US', 'FR']) {
        const [hb, bg] = await renderBoth(tpl, { country }, reg.hb, reg.bg);
        expect(bg, `country=${country}`).toEqual(hb);
      }
    });

    it('matches Handlebars passing a subexpression as a helper argument', async () => {
      const reg = {
        hb: (hb: typeof Handlebars) => {
          hb.registerHelper('shout', (value: unknown) => String(value).toUpperCase());
          hb.registerHelper('wrap', (value: unknown) => `[${String(value)}]`);
        },
        bg: (bg: Bigodin) => {
          bg.addHelper('shout', (value: unknown) => String(value).toUpperCase());
          bg.addHelper('wrap', (value: unknown) => `[${String(value)}]`);
        },
      };
      const [hb, bg] = await renderBoth('{{wrap (shout name)}}', { name: 'hi' }, reg.hb, reg.bg);
      expect(bg).toEqual(hb);
    });
  });

  describe('if', () => {
    it('matches Handlebars for truthy and falsy scalars', async () => {
      const tpl = '{{#if a}}Y{{else}}N{{/if}}';
      await expectParity(tpl, { a: 'x' });
      await expectParity(tpl, { a: '' });
      await expectParity(tpl, { a: 0 });
      await expectParity(tpl, { a: 1 });
      await expectParity(tpl, { a: null });
      await expectParity(tpl, {});
    });

    it('matches Handlebars without an else branch', async () => {
      const tpl = '{{#if a}}Y{{/if}}';
      await expectParity(tpl, { a: 'x' });
      await expectParity(tpl, { a: '' });
    });

    it('matches Handlebars for nested conditionals', async () => {
      const tpl = '{{#if a}}{{#if b}}AB{{else}}A{{/if}}{{/if}}';
      await expectParity(tpl, { a: true, b: true });
      await expectParity(tpl, { a: true, b: false });
      await expectParity(tpl, { a: false, b: true });
    });

    it('matches Handlebars for a three-branch else-if chain', async () => {
      const tpl = '{{#if a}}A{{else if b}}B{{else if cc}}C{{else}}D{{/if}}';
      await expectParity(tpl, { a: true });
      await expectParity(tpl, { b: true });
      await expectParity(tpl, { cc: true });
      await expectParity(tpl, {});
    });
  });

  describe('unless', () => {
    it('matches Handlebars for truthy and falsy scalars', async () => {
      const tpl = '{{#unless a}}Y{{else}}N{{/unless}}';
      await expectParity(tpl, { a: 'x' });
      await expectParity(tpl, { a: '' });
      await expectParity(tpl, { a: 0 });
    });

    it('matches Handlebars without an else branch', async () => {
      await expectParity('{{#unless a}}Y{{/unless}}', { a: 'x' });
    });
  });

  describe('with', () => {
    it('matches Handlebars when entering an object context', async () => {
      await expectParity('{{#with a}}{{name}}{{/with}}', { a: { name: 'Al' } });
    });

    it('matches Handlebars on the else branch for a falsy value', async () => {
      const tpl = '{{#with a}}{{name}}{{else}}none{{/with}}';
      await expectParity(tpl, { a: null });
      await expectParity(tpl, { a: false });
    });

    it('matches Handlebars reaching the parent context with ../', async () => {
      await expectParity('{{#with a}}{{name}}-{{../top}}{{/with}}', {
        top: 'T',
        a: { name: 'Al' },
      });
    });
  });

  describe('each', () => {
    it('matches Handlebars iterating an array', async () => {
      await expectParity('{{#each xs}}({{this}}){{/each}}', { xs: ['a', 'b', 'c'] });
    });

    it('matches Handlebars exposing @index', async () => {
      await expectParity('{{#each xs}}{{@index}}:{{this}};{{/each}}', { xs: ['a', 'b'] });
    });

    it('matches Handlebars exposing @key as the array index', async () => {
      await expectParity('{{#each xs}}{{@key}}={{this}};{{/each}}', { xs: ['a', 'b'] });
    });

    it('matches Handlebars exposing @first and @last', async () => {
      await expectParity(
        '{{#each xs}}{{#if @first}}[{{/if}}{{this}}{{#if @last}}]{{/if}}{{/each}}',
        {
          xs: ['a', 'b', 'c'],
        },
      );
    });

    it('matches Handlebars on the else branch for an empty array', async () => {
      await expectParity('{{#each xs}}x{{else}}empty{{/each}}', { xs: [] });
    });

    it('matches Handlebars reaching the parent context with ../', async () => {
      await expectParity('{{#each xs}}{{../label}}{{this}};{{/each}}', {
        label: 'L',
        xs: [1, 2],
      });
    });

    it('matches Handlebars reaching the root context with @root', async () => {
      await expectParity('{{#each xs}}{{@root.top}}{{this}};{{/each}}', {
        top: 'R',
        xs: [1, 2],
      });
    });
  });

  describe('whitespace control (~)', () => {
    it('matches Handlebars trimming on each side of an interpolation', async () => {
      await expectParity('a  {{~x}}  b', { x: 'X' });
      await expectParity('a  {{x~}}  b', { x: 'X' });
      await expectParity('a  {{~x~}}  b', { x: 'X' });
      await expectParity('  {{~name~}}  ', { name: 'X' });
    });

    it('matches Handlebars trimming greedily across newlines', async () => {
      await expectParity('a\n\n  {{~x~}}\n\n b', { x: 'X' });
    });

    it('matches Handlebars on raw forms', async () => {
      await expectParity('a {{~{x}~}} b', { x: 'X' });
      await expectParity('a {{~{x}}} b', { x: 'X' });
      await expectParity('a {{{x}~}} b', { x: 'X' });
      await expectParity('a {{~&x~}} b', { x: 'X' });
    });

    it('matches Handlebars on comments', async () => {
      await expectParity('a {{~! c ~}} b', {});
      await expectParity('a {{~! c }} b', {});
    });

    it('matches Handlebars on block open/close and else', async () => {
      await expectParity('a {{~#if x~}} body {{~/if~}} b', { x: true });
      await expectParity('a {{~#if x}}body{{/if~}} b', { x: true });
      await expectParity('x {{~#if a~}}T{{~else~}}F{{~/if~}} y', { a: false });
      await expectParity('x {{#if a}}T{{~else if b~}}B{{else}}F{{/if}} y', {
        a: false,
        b: true,
      });
    });

    it('matches Handlebars combined with standalone-line layouts', async () => {
      await expectParity('line\n  {{~! standalone ~}}\n  next', {});
    });
  });

  describe('block params (as |a b|)', () => {
    it('matches Handlebars binding element and index in each', async () => {
      await expectParity('{{#each xs as |item idx|}}{{idx}}:{{item}};{{/each}}', {
        xs: ['a', 'b'],
      });
    });

    it('matches Handlebars binding the context in with', async () => {
      await expectParity('{{#with user as |u|}}{{u.name}}{{/with}}', { user: { name: 'Al' } });
    });

    it('matches Handlebars when a block param shadows a context key', async () => {
      await expectParity('{{#each xs as |item|}}{{item}}{{/each}}', { xs: ['a'], item: 'ctx' });
    });

    it('matches Handlebars accessing a block param field', async () => {
      await expectParity('{{#each xs as |row|}}{{row.num}};{{/each}}', {
        xs: [{ num: 1 }, { num: 2 }],
      });
    });

    it('matches Handlebars falling back to context for a non-param name', async () => {
      await expectParity('{{#each xs as |item|}}{{other}};{{/each}}', {
        xs: [{ other: 'O' }],
      });
    });

    it('matches Handlebars for nested block params', async () => {
      await expectParity(
        '{{#each rows as |row r|}}{{#each row as |cell c|}}{{r}}{{c}}:{{cell}};{{/each}}{{/each}}',
        { rows: [['a', 'b'], ['c']] },
      );
    });
  });

  // Differences bigodin documents as intentional. Each asserts bigodin's
  // documented behavior (and contrasts it with Handlebars) so the decision
  // is visible and any change to it trips a test.
  describe('documented divergences', () => {
    it('never HTML-escapes {{x}}, unlike Handlebars (website/docs/language/raw-output)', async () => {
      const tpl = '<p>{{name}}</p>';
      const ctx = { name: '<b>&"\'' };
      const handlebarsOut = Handlebars.compile(tpl)(ctx);
      const bigodinOut = await compile(tpl)(ctx);
      expect(handlebarsOut).toEqual('<p>&lt;b&gt;&amp;&quot;&#x27;</p>');
      expect(bigodinOut).toEqual('<p><b>&"\'</p>');
    });

    it('recovers Handlebars escaping through a user-registered escape helper', async () => {
      const bg = new Bigodin();
      bg.addHelper('e', (value: unknown) => Handlebars.escapeExpression(String(value)));
      const ctx = { name: '<b>&"' };
      const handlebarsOut = Handlebars.compile('<p>{{name}}</p>')(ctx);
      const bigodinOut = await bg.compile('<p>{{e name}}</p>')(ctx);
      expect(bigodinOut).toEqual(handlebarsOut);
    });

    it('treats an empty array as truthy in {{#if}} (if coerces with Boolean; website/docs/helpers#if)', async () => {
      const tpl = '{{#if a}}Y{{else}}N{{/if}}';
      const handlebarsOut = Handlebars.compile(tpl)({ a: [] });
      const bigodinOut = await compile(tpl)({ a: [] });
      expect(handlebarsOut).toEqual('N');
      expect(bigodinOut).toEqual('Y');
    });

    it('wraps a non-array {{#each}} argument as a single iteration (website/docs/helpers#each)', async () => {
      const tpl = '{{#each obj}}{{@key}}={{this}};{{/each}}';
      const ctx = { obj: { a: 1, b: 2 } };
      const handlebarsOut = Handlebars.compile(tpl)(ctx);
      const bigodinOut = await compile(tpl)(ctx);
      // Handlebars walks the object's entries, exposing @key as the property name.
      expect(handlebarsOut).toEqual('a=1;b=2;');
      // Bigodin treats the object as one item: @key is index 0 and `this` is
      // the whole object (stringified via Object.prototype.toString).
      expect(bigodinOut).toEqual('0=[object Object];');
    });

    it('has no {{!--}} long-comment form: a comment ends at the first }} (website/docs/language/comments)', async () => {
      const tpl = 'a{{! has }} inside }}b';
      expect(Handlebars.compile(tpl)({})).toEqual('a inside }}b');
      // bigodin parses eagerly, so the unsupported syntax throws at compile time.
      expect(() => compile(tpl)).toThrow();
    });

    it('does not support numeric array indexing in path syntax (website/docs/language/path-expressions)', async () => {
      const tpl = '{{xs.[1]}}';
      expect(Handlebars.compile(tpl)({ xs: ['a', 'b'] })).toEqual('b');
      expect(() => compile(tpl)).toThrow();
    });

    it('ships no built-in non-block helpers like lookup/log (website/docs/helpers)', async () => {
      expect(Handlebars.compile('{{lookup xs 1}}')({ xs: ['a', 'b'] })).toEqual('b');
      await expect(compile('{{lookup xs 1}}')({ xs: ['a', 'b'] })).rejects.toThrow();
    });

    it('does not support Handlebars whitespace-control beyond ~ (no block params on else)', async () => {
      // Handlebars accepts block params only on block openers, same as bigodin;
      // this pins that a closing tag with params is rejected by bigodin.
      expect(() => compile('{{#each xs as |i|}}{{/each as |j|}}')).toThrow();
    });
  });
});
