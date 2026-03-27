import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
    external: ['react', 'react-dom'],
    banner: { js: '"use client";' },
  },
  {
    entry: { plugin: 'src/plugin.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
  },
])
