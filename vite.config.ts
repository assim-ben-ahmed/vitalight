import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // /api goes to the Python server in dev (npm run api); FastAPI serves both in production.
  server: { port: 5180, proxy: { '/api': 'http://127.0.0.1:8000' } },
})
