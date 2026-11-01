import { defineConfig, searchForWorkspaceRoot } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const proxy = {
  '/api': {
    target: process.env.TECHBRIDGE_API_PROXY || 'http://127.0.0.1:5000',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy,
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), fileURLToPath(new URL('../backend/src/data/communityDirectory.json', import.meta.url))] },
  },
  preview: { proxy },
})
