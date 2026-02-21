import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Ensure logs directory exists at project root
const logsDir = path.resolve(__dirname, '../../logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// Simple file logger for Vite
const logStream = fs.createWriteStream(path.join(logsDir, 'anchor_ui.log'), { flags: 'a' })
const logWithTimestamp = (level: string, message: string) => {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`
  logStream.write(logLine)
  // Also output to console for development
  if (level === 'error' || level === 'warn') {
    console[level](`[UI] ${message}`)
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  logLevel: 'warn', // Suppress info messages like "press h + enter to show help"
  clearScreen: false, // Don't clear screen on rebuild
  customLogger: {
    info: (msg) => logWithTimestamp('info', msg),
    warn: (msg) => logWithTimestamp('warn', msg),
    error: (msg, opts) => logWithTimestamp('error', opts?.error?.message || msg),
    clear: () => {
      // Clear console but keep file logging
      console.clear()
    },
    hasWarned: false,
    hasErrorLogged: false
  },
  server: {
    host: true, // Listen on all addresses (0.0.0.0)
    strictPort: true,
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:3160',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:3160',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
