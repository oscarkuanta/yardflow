import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const noCommentsRule = {
  meta: {
    type: 'suggestion',
    messages: {
      noComment: 'Comments are not allowed. Use clear names and small functions instead.',
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type !== 'Shebang') {
            context.report({ loc: comment.loc, messageId: 'noComment' });
          }
        }
      },
    };
  },
};

export default [
  {
    ignores: ['**/node_modules/**', '**/coverage/**', '**/dist/**', '**/playwright-report/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    plugins: {
      yardflow: { rules: { 'no-comments': noCommentsRule } },
    },
    rules: {
      'yardflow/no-comments': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    files: ['apps/web/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['apps/web/public/**/*.js'],
    languageOptions: { sourceType: 'script' },
  },
  eslintConfigPrettier,
];
