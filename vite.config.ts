import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-manifest-json',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && (req.url === '/manifest.json' || req.url.startsWith('/manifest.json?'))) {
            const manifestPath = path.resolve(__dirname, 'public/manifest.json')
            if (fs.existsSync(manifestPath)) {
              const content = fs.readFileSync(manifestPath, 'utf-8')
              res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.setHeader('Cache-Control', 'no-cache')
              res.statusCode = 200
              res.end(content)
              return
            }
          }
          next()
        })
      }
    }
  ],
})