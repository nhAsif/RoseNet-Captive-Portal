import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Go backend serves static files from `frontend/` (dev) or `/www/voucher`
// (router). We emit the built admin SPA into `../frontend/admin` so it is served
// at `/admin/` and gets copied to the router by scripts/install.sh.
//
// `base: './'` keeps all asset URLs relative, so they resolve correctly under
// the `/admin/` sub-path without hardcoding it.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../frontend/admin',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Proxy the admin JSON API to the running Go server during `npm run dev`.
    // Start the backend first: `cd backend && go run .`
    proxy: {
      '/admin': 'http://localhost:7891',
      '/binauth-stage': 'http://localhost:7891',
      '/binauth-check': 'http://localhost:7891',
    },
  },
})
