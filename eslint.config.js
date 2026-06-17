import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', '*.tsbuildinfo', 'vite.config.js', 'vite.config.d.ts', 'supabase/functions', 'outputs', 'work'],
  },
  js.configs.recommended,
  // Type-checked rules only apply to the typed source tree. Spreading them at the
  // top level made ESLint try to type-check plain .js config/scripts (which have no
  // project service), which crashed the whole run.
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // The Supabase client surfaces query results as `any`, so the unsafe-* family
      // fires on essentially every query without flagging real defects. Turn off the
      // noise so the rules that actually catch bugs stay legible.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      // `status === 'SUBSCRIBED'` etc. is the documented Supabase realtime pattern;
      // the enum value equals the string literal at runtime.
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      // Existing fire-and-forget call sites; surface as warnings rather than blocking.
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
    },
  },
  // Service worker globals (self, caches, fetch, Response, ...).
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.serviceworker },
    },
  },
  // Other plain browser scripts shipped from /public. These are hand-written,
  // bundled-style scripts with intentional empty `catch {}` guards.
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', { caughtErrors: 'none', argsIgnorePattern: '^_' }],
    },
  },
  // Node-run build/setup scripts.
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  // Plain JS never gets type-aware linting (no project service for it).
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
)
