import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  server: {
    // Honour PORT so several dev servers can share the machine.
    port: Number(process.env.PORT) || 5173,
    host: true,
  },
})
