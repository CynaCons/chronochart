import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', '**/dist/**', 'node_modules', '**/*.cjs', 'update_all_tests.js', 'functions/lib', 'powerspawn', 'coverage', '.claude', 'agent-tools', 'mcps', 'terminals', 'screenshots'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // React/TypeScript application code (excludes tests and scripts)
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Stricter TypeScript rules
      '@typescript-eslint/no-explicit-any': 'warn', // TODO: Fix in v0.3.2 - Critical Code Quality Fixes
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-empty-function': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off', // Too verbose for React components
      '@typescript-eslint/explicit-module-boundary-types': 'off', // Too verbose for React components

      // General code quality rules
      'no-empty': 'error',
      'no-console': 'off', // Allow console for development/debug code
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': 'error',
      'no-debugger': 'error',
      'no-case-declarations': 'error',

      // React specific rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // Node.js scripts configuration (JS and TS)
  {
    files: ['scripts/**/*.{js,mjs,ts}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      sourceType: 'module',
    },
    rules: {
      'no-console': 'off',
      'no-process-exit': 'off',
      '@typescript-eslint/no-unused-vars': 'off', // Scripts may have temporary unused vars
      '@typescript-eslint/no-explicit-any': 'off', // Scripts can use any
    },
  },
  // Test files configuration (Playwright tests)
  {
    files: ['tests/**/*.{ts,tsx,js}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      sourceType: 'module',
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off', // Tests may have prepared but unused imports
      '@typescript-eslint/no-explicit-any': 'off', // Tests can use any
    },
  }
)
