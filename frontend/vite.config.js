// C:\QR\frontend\vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001', // ← IPv4 erzwingen
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: 'ws://127.0.0.1:3001',   // ← WS auch auf IPv4
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  }
})
