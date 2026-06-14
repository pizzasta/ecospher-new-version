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
    ...tseslint.configs.recommendedTypeChecked,
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
                '@typescript-eslint/no-floating-promises': 'error',
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
        },
  },
  )
