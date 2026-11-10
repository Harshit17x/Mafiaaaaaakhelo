import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'zustand'],
          'vendor-three': ['three'],
          'vendor-motion': ['framer-motion', 'lucide-react'],
          'vendor-socket': ['socket.io-client'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3001',
      },
      '/health': {
        target: 'http://localhost:3001',
      },
    },
  },
});
