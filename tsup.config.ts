import { defineConfig } from 'tsup';
import { config } from 'dotenv';

config();

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    target: 'node20',
    outDir: 'dist',
    clean: true,
    sourcemap: true,
    dts: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: ['src/mcp.ts'],
    format: ['cjs'],
    target: 'node20',
    outDir: 'dist',
    clean: false,
    sourcemap: true,
    dts: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
