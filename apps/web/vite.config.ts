import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  envDir: fileURLToPath(new URL('../../', import.meta.url)),
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      'localhost',
      '.localhost',
      '.trycloudflare.com',
      '70.70.170.73',
    ],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
      },
    },
  },
})
