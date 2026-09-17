import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'design-source/**', 'scripts/**'] },
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      // The single scroll listener lives in src/motion/ScrollBroker.ts and in
      // NavBar's scrolled flag. Everything else subscribes to the broker
      // (docs/audit/effects-integration.md B10).
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='addEventListener'][arguments.0.value='scroll']",
          message:
            'Subscribe to src/motion/ScrollBroker instead of adding a scroll listener (audit B10).',
        },
      ],
    },
  },
  {
    files: ['src/motion/ScrollBroker.ts', 'src/design-system/navigation/NavBar.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
]

export default config
