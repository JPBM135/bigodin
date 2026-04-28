import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import Bigodin from '../src';

const SKIPPED_SPECS = [
  'partials.json',
  '~dynamic-names.json',
  'delimiters.json',
  '~inheritance.json',
  '~lambdas.json',
];

const SKIPPED_FEATURES = [
  'Parent contexts',
  'List Contexts',
  'Deeply Nested Contexts',
  'Variable test',
  'HTML Escaping',
].map((feature) => feature.toLowerCase());

describe('spec', () => {
  /* $lab:coverage:off$ */
  if (typeof process === 'undefined') {
    return;
  }
  /* $lab:coverage:on$ */

  const specDir = path.join(__dirname, 'mustache', 'specs');
  const specs = fs.readdirSync(specDir).filter((name) => /.*\.json$/.test(name));

  for (const name of specs) {
    const spec = JSON.parse(fs.readFileSync(path.join(specDir, name), 'utf8'));
    if (SKIPPED_SPECS.some((specToSkip) => name.includes(specToSkip))) {
      describe.skip(name, () => {});
      continue;
    }

    describe(name, () => {
      for (const test of spec.tests) {
        if (SKIPPED_FEATURES.some((feature) => test.name.toLowerCase().includes(feature))) {
          it.skip(test.name, () => {});
          return;
        }

        it(test.name, async () => {
          let data: any;
          if (Array.isArray(test.data)) {
            data = test.data.slice();
          } else if (test.data && typeof test.data === 'object') {
            data = { ...test.data };
            if (data.lambda) {
              // eslint-disable-next-line no-eval
              data.lambda = eval('(' + data.lambda.js + ')');
            }
          } else {
            data = test.data;
          }

          const bigodin = new Bigodin();

          const template = bigodin.compile(test.template);
          const result = await template(data);

          expect(result, test.desc).toEqual(test.expected);
        });
      }
    });
  }
});
