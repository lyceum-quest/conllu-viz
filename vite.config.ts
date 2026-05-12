import { defineConfig } from 'vite';

export default defineConfig({
  cacheDir: '/tmp/conllu-vite-cache',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      protocol: 'wss',
      clientPort: 443,
    },
  },
});
