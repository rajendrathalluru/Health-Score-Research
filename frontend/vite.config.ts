import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/privacy-policy': 'http://localhost:3001',
      '/terms-and-conditions': 'http://localhost:3001',
    },
  },
})
