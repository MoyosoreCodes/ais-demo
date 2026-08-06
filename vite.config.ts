import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    host: true,
  },
  build: {
    // Keep the demo bundle inspectable: split the heavy export/map/chart libs
    // so first paint is not blocked by jspdf + xlsx.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Function form rather than an object map so a library that no wave
        // has pulled in yet does not emit an empty chunk.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/.test(id)) return 'maps'
          if (/[\\/]node_modules[\\/](recharts|d3-|victory-)/.test(id)) return 'charts'
          if (/[\\/]node_modules[\\/](jspdf|jspdf-autotable|xlsx)[\\/]/.test(id)) return 'exports'
          return undefined
        },
      },
    },
  },
})
