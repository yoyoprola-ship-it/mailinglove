import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Single source of truth for the postcard catalog: src/data/postcards.json,
// imported by the frontend and read here so the server can validate a
// postcardId and snapshot its title/image into an order.
const path = fileURLToPath(new URL('../src/data/postcards.json', import.meta.url))
const data = JSON.parse(readFileSync(path, 'utf8'))

const byId = new Map(data.postcards.map((p) => [p.id, p]))

export function getPostcard(id) {
  return byId.get(id) || null
}

export const catalog = data
