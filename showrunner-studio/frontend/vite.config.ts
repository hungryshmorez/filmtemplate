import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(() => {
  const backendPort = process.env.BACKEND_PORT || '3101'
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      strictPort: true,
      port: Number(process.env.APP_PORT) || 3001,
      allowedHosts: true as const,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
