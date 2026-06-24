import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// a short, human-readable build stamp so a running client can be matched to a
// deploy — surfaced small in Settings to diagnose stale-cache complaints.
const BUILD_STAMP = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
// a unique-per-build id used to version the service worker: each deploy gets a
// fresh /sw.js?v=<id> URL + cache name, so already-installed clients always see
// an update, purge the old cache, and reload once into the new bundle.
const BUILD_ID = Date.now().toString(36)

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_BUILD_STAMP': JSON.stringify(BUILD_STAMP),
    'import.meta.env.VITE_SW_VERSION': JSON.stringify(BUILD_ID),
  },
  // NEXT_PUBLIC_ covers the Vercel × Supabase Native Integration's variable
  // names; both prefixes are public-by-convention values only
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        // rolldown (vite 8) requires the function form
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react'
            if (id.includes('@supabase')) return 'vendor-supabase'
            if (id.includes('framer-motion')) return 'vendor-motion'
          }
          return undefined
        },
      },
    },
  },
})
