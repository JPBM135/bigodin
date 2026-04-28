import { common, node, prettier, typescript } from 'eslint-config-neon';
import merge from 'lodash.merge';

/**
 * @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray}
 */
const globalConfig = [
  {
    ignores: ['.yarn/', 'dist/', 'node_modules/', 'scripts/**'],
  },
  ...[
    ...common,
    ...node,
    ...typescript,
    ...prettier,
    {
      rules: {
        'n/no-sync': 'off',
        'n/prefer-global/process': 'off',
        'n/prefer-global/url': 'off',
        'n/prefer-global/url-search-params': 'off',
        '@typescript-eslint/prefer-nullish-coalescing': 'error',
        'no-restricted-imports': [
          'warn',
          {
            patterns: [
              {
                group: ['node:*'],
                message:
                  "This package can be used in a Client-side application. Do not use node:* unless you are sure the client won't import it.",
              },
            ],
          },
        ],
        '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
        'rxjs/no-implicit-any-catch': 'off',
        '@typescript-eslint/no-unused-vars': 'error',
        'no-restricted-globals': 'off',
        'unicorn/prefer-node-protocol': 'error',
        'unicorn/filename-case': [
          'error',
          {
            case: 'kebabCase',
          },
        ],
      },
    },
  ].map((config) =>
    merge(config, {
      files: ['src/**/*.ts', 'test/**/*.ts'],
      languageOptions: {
        parserOptions: {
          projectService: true,
        },
      },
    }),
  ),
  {
    files: ['src/**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/dot-notation': 'off',
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/**/*.spec-d.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: [
      'src/constants/errors.codes.ts',
      'src/constants/errors.messages.ts',
      'src/constants/errors/**/*.ts',
    ],
    rules: {
      'sort-keys': 'error',
    },
  },
];

export default globalConfig;
