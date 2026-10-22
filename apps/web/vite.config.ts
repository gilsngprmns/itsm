import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  envDir: fileURLToPath(new URL('../../', import.meta.url)),
  plugins: [react()],
})
