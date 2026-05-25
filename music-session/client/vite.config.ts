import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const serverTarget = process.env.VITE_SERVER_URL || 'http://localhost:4000'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 3000,
    proxy: {
      '/api': { target: serverTarget, changeOrigin: true },
      '/socket.io': { target: serverTarget, ws: true },
    },
  },
})
