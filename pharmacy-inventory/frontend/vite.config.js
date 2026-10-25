import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listen on all network IP addresses
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:5001',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 3000
  },
  test: {
    environment: 'jsdom',
    globals: true,
    environmentOptions: {
      jsdom: { url: 'http://localhost/' },
    },
    setupFiles: ['./src/test/setup.js'],
    css: false,
  }
})
