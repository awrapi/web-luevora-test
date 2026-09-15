import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Custom plugin to silently handle browser extension security/anti-miner probes
const ignoreWasmProbesPlugin = () => ({
  name: 'ignore-wasm-probes',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url && (req.url.includes('miner-wasm-probe') || req.url.includes('.wasm?'))) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Not found');
        return;
      }
      next();
    });
  },
})

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    ignoreWasmProbesPlugin(),
    react(),
    tailwindcss(),
  ],
  server: {
    allowedHosts: true,
    hmr: {
      overlay: false, // Prevent error overlay popups on client screens
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      // Forward all /api/* requests to the backend
      '/api': {
        target: 'http://127.0.0.1:4001',
        changeOrigin: true,
        secure: false,
      },
      // Forward /uploads/* (static files: invoices, media)
      '/uploads': {
        target: 'http://127.0.0.1:4001',
        changeOrigin: true,
        secure: false,
      },
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three')) {
            return 'vendor-three';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-recharts';
          }
          if (id.includes('node_modules/xlsx')) {
            return 'vendor-xlsx';
          }
        }
      }
    }
  }
})
