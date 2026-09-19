import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/EventFlow/',
  resolve: {
    alias: {
      'react-router-dom': fileURLToPath(new URL('./src/lib/react-router-dom.tsx', import.meta.url)),
    },
  },
})
