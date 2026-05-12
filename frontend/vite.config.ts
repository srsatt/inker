import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Backend URL: use env var if set, otherwise local backend.
  const backendUrl = process.env.VITE_BACKEND_URL || env.VITE_BACKEND_URL || 'http://127.0.0.1:3338'

  // Allowed hosts for domain access (comma-separated in env var)
  // Example: VITE_ALLOWED_HOSTS=myapp.example.com,app.mydomain.org
  const allowedHostsEnv = process.env.VITE_ALLOWED_HOSTS || env.VITE_ALLOWED_HOSTS || ''
  const allowedHosts = allowedHostsEnv ? allowedHostsEnv.split(',').map(h => h.trim()) : true
  const host = process.env.VITE_HOST || env.VITE_HOST || '127.0.0.1'
  const port = Number(process.env.VITE_PORT || env.VITE_PORT || 3337)

  return {
    plugins: [react()],
    server: {
      port,
      host,
      allowedHosts,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: false,
          secure: false,
        },
        '/uploads': {
          target: backendUrl,
          changeOrigin: false,
          secure: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      minify: 'esbuild',
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            axios: ['axios'],
            // CodeMirror is heavy and only used in custom widget script editor
            codemirror: ['codemirror', '@codemirror/lang-javascript', '@codemirror/autocomplete', '@codemirror/view', '@codemirror/state', '@lezer/highlight'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'axios'],
    },
  }
})
