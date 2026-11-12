import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const rootDir =
  typeof import.meta.dirname === 'string'
    ? import.meta.dirname
    : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
              return 'vendor-charts';
            }
            if (
              id.includes('node_modules/@capacitor') ||
              id.includes('node_modules/idb')
            ) {
              return 'vendor-hybrid';
            }
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio preview environment
      hmr: false,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
