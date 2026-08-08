import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';
import path from 'path';

export default defineConfig({
  plugins: [react(), cesium()],
  resolve: {
    alias: {
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@adapters': path.resolve(__dirname, 'src/adapters'),
      '@state': path.resolve(__dirname, 'src/state'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@config': path.resolve(__dirname, 'src/config'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
