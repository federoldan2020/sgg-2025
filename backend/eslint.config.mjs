// eslint.config.mjs  (Flat Config, ESM)

/**
 * Importante: usá versiones compatibles
 *   "eslint": "^9.x",
 *   "typescript-eslint": "^8.x",
 *   "@eslint/js": "^9.x",
 *   "eslint-plugin-prettier": "^5.x",
 *   "prettier": "^3.x"
 * Si tu proyecto tiene otras, actualizá primero.
 */

import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettierPluginRecommended from 'eslint-plugin-prettier/recommended';

export default [
  // 1) Ignorados globales
  {
    ignores: [
      'dist',
      'node_modules',
      'prisma/**/*.js', // por si generás helpers JS
    ],
  },

  // 2) Base recomendada de ESLint
  eslint.configs.recommended,

  // 3) Recomendados de typescript-eslint con type-check
  ...tseslint.configs.recommendedTypeChecked,

  // 4) Prettier (flat config)
  prettierPluginRecommended,

  // 5) Setup general para TS/Node
  {
    files: ['**/*.ts'],
    languageOptions: {
      sourceType: 'commonjs', // si pasás a ESM: 'module'
      parserOptions: {
        projectService: true,         // autodetecta tsconfig
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      // Prettier + estilo
      'prettier/prettier': [
        'error',
        { endOfLine: 'lf', singleQuote: true, semi: true, trailingComma: 'all', printWidth: 100 },
      ],

      // Suavizar ruido típico con Nest/Express/middlewares/scripts
      '@typescript-eslint/no-misused-promises': ['warn', { checksVoidReturn: false }],
      '@typescript-eslint/no-floating-promises': ['warn', { ignoreVoid: true }],
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // 6) Overrides para seed/scripts (aún más permisivos)
  {
    files: ['prisma/seed.ts', 'scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
];
