import { browser, common, node, react, prettier, typescript, mdx } from 'eslint-config-neon';

/**
 * @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray}
 */
const globalConfig = [
  {
    ignores: [
      '.yarn/',
      'dist/',
      'node_modules/',
      '.esbuild/',
      '.serverless/',
      'src/generated/**/*',
      'coverage/',
      'build/',
      '.docusaurus/',
    ],
  },
  ...common,
  ...browser,
  ...node,
  ...typescript,
  ...react,
  ...prettier,
  ...[...mdx].map((cfg) => ({
    ...cfg,
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    files: ['docs/**/*.{mdx}'],
  })),
  {
    settings: {
      react: {
        version: 'detect',
      },
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        extraFileExtensions: ['.mdx'],
      },
    },
    rules: {
      'react/react-in-jsx-scope': 0,
      'react/jsx-filename-extension': [1, { extensions: ['.tsx'] }],
      'no-restricted-globals': 0,
    },
  },
];

export default globalConfig;
