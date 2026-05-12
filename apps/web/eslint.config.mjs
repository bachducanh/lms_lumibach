import { baseConfig, ignoreConfig } from '@lumibach/config/eslint.base.mjs';

const eslintConfig = [
  ...baseConfig,
  {
    ...ignoreConfig,
    ignores: [...ignoreConfig.ignores, '.next/**', 'next-env.d.ts'],
  },
];

export default eslintConfig;
