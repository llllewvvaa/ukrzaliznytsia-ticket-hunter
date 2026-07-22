import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['.wxt/', '.output/', 'fixtures/', 'public/', 'docs/', 'pnpm-lock.yaml'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Core hook rules. The compiler-powered rules from react-hooks v7
      // (refs, set-state-in-effect) flag patterns this codebase predates —
      // enable them separately once the components are refactored for them.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    plugins: { 'jsx-a11y': jsxA11y },
    // a11y runs as warnings: it should educate, not block the build.
    rules: Object.fromEntries(
      Object.keys(jsxA11y.flatConfigs.recommended.rules ?? {}).map((rule) => [rule, 'warn']),
    ),
  },
  {
    rules: {
      // tsconfig has verbatimModuleSyntax — keep type-only imports explicit.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        // import() type annotations stay allowed: `importOriginal<typeof import('./x')>()`
        // is the standard vitest mock idiom.
        { fixStyle: 'separate-type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['*.js', 'scripts/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
