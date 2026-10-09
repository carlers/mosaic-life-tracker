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
      // Namespace imports bypass named-service restrictions and can create an
      // unguarded client from any feature module. Safe named value helpers
      // (Query, ID, Permission, Role) remain legal outside the SDK owners.
      'no-restricted-syntax': ['error', {
        selector: "ImportDeclaration[source.value='appwrite'] > ImportNamespaceSpecifier",
        message: 'Use safe named Appwrite value helpers or the guarded SDK instead of namespace imports.',
      }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'appwrite',
              importNames: ['Client', 'Databases', 'TablesDB', 'Storage', 'Functions', 'Account', 'Users'],
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
      'no-restricted-syntax': 'off',
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
