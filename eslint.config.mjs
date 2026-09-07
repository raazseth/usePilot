// @ts-check
import js from '@eslint/js'
import importPlugin from 'eslint-plugin-import'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // 1. Global Ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/target/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/artifacts/**',
      '**/*.log',
    ],
  },

  // 2. Base JavaScript rules
  js.configs.recommended,

  // 3. TypeScript files across monorepo
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.es2024,
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      import: /** @type {any} */ (importPlugin),
    },
    rules: {
      // TypeScript specific
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Disable conflicting core ESLint rules (handled by TypeScript compiler & TS-ESLint)
      'no-unused-vars': 'off',
      'no-undef': 'off',

      // Module Imports
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',

      // General Code Quality
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  },

  // 4. React & Desktop frontend files
  {
    files: ['apps/desktop/**/*.{ts,tsx}'],
    plugins: {
      react: /** @type {any} */ (reactPlugin),
      'react-hooks': /** @type {any} */ (reactHooksPlugin),
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-no-target-blank': 'warn',
      'react/display-name': 'off',
    },
  },

  // 5. Test files (Vitest / Unit / Integration)
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },

  // 6. Scripts, Seeds, and Migrations
  {
    files: ['**/scripts/**', '**/seed.ts', '**/migrate.ts', '**/copy-migrations.js'],
    rules: {
      'no-console': 'off',
    },
  },

  // 7. Configuration files
  {
    files: ['**/*.config.{js,mjs,cjs,ts}', '**/vite.config.ts'],
    rules: {
      'no-console': 'off',
    },
  },
)
