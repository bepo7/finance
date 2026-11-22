import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// base relativa: funciona no GitHub Pages (/finance/) e abrindo dist/ localmente
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: { manualChunks: (id) => (id.includes('node_modules/echarts') || id.includes('node_modules/zrender') ? 'echarts' : undefined) },
    },
  },
})
