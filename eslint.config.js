import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'claude-reference/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['database/migrations/**/*.cjs', 'database/scripts/**/*.cjs'],
    languageOptions: { globals: { ...globals.commonjs, ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
  },
  prettier,
);
