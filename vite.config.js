import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true, allowedHosts: ['.sg2.manus.computer'] },
  build: { outDir: 'dist', emptyOutDir: true }
});
