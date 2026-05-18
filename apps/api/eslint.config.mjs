import { baseConfig, ignoreConfig } from '@lumibach/config/eslint.base.mjs';

const eslintConfig = [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    ...ignoreConfig,
    ignores: [...ignoreConfig.ignores, 'dist/**'],
  },
];

export default eslintConfig;
