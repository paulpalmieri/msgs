/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { devExportPlugin } from './dev/devExportPlugin.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), devExportPlugin(env.MSGS_EXPORT_DIR)],
    optimizeDeps: { exclude: ['@duckdb/duckdb-wasm'] },
    worker: { format: 'es' },
    test: { environment: 'node', testTimeout: 120_000 },
  };
});
