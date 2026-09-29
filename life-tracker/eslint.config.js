import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.mosaic-backup']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'appwrite',
              importNames: ['TablesDB', 'Storage', 'Functions', 'Account'],
              message:
                'Import the guarded SDK surface from src/lib/sdk.ts instead. Raw SDK service classes may only be constructed in src/lib/sdk.ts and src/lib/appwrite.ts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/lib/sdk.ts', 'src/lib/appwrite.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/components/friend/FriendDayViewSheet.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^ImageIcon$' }],
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
])
