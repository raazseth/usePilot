import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(__dirname, 'src', 'migrations')
const dist = path.join(__dirname, 'dist', 'migrations')

if (fs.existsSync(src)) {
  fs.cpSync(src, dist, { recursive: true })
}
