import { all, get, nowISO, run } from './db.ts'
import { loadTrips, productStats } from './history.ts'
import { HttpError } from './http.ts'
import { catalogEntry } from '../shared/catalog.ts'
import type { CategoryId } from '../shared/categories.ts'
import {
  buildTargets,
  capitalize,
  guessCategory,
  matchKey,
  parseQuantity,
  recognise,
} from '../shared/match.ts'
import type { AddItemInput, Product } from '../shared/types.ts'

export function listProducts(): Product[] {
  const rows = all<{ id: number; name: string; category: CategoryId; catalogKey: string | null }>(
    'SELECT id, name, category, catalog_key AS catalogKey FROM products',
  )
  const aliases = all<{ productId: number; alias: string }>(
    'SELECT product_id AS productId, alias FROM aliases ORDER BY alias',
  )
  const stats = productStats(loadTrips())
  return rows
    .map((row) => {
      const s = stats.get(row.id)
      return {
        ...row,
        aliases: aliases.filter((a) => a.productId === row.id).map((a) => a.alias),
        timesBought: s?.times ?? 0,
        lastBought: s ? new Date(s.last).toISOString() : null,
        intervalDays: s?.intervalDays ?? null,
      }
    })
    .sort((a, b) => b.timesBought - a.timesBought || a.name.localeCompare(b.name))
}

function productForCatalog(key: string, name: string): number {
  const existing = get<{ id: number }>('SELECT id FROM products WHERE catalog_key = ?', key)
  if (existing) return existing.id
  const entry = catalogEntry(key)
  if (!entry) throw new HttpError(400, 'Unknown product')
  const result = run(
    'INSERT INTO products (name, category, catalog_key, created_at) VALUES (?, ?, ?, ?)',
    name,
    entry.category,
    key,
    nowISO(),
  )
  return Number(result.lastInsertRowid)
}

/**
 * Works out which product was meant. A picked suggestion says so directly; otherwise the text is
 * matched against the household's products and the catalog in both languages, and only something
 * truly new becomes a new product.
 */
export function resolveItem(input: AddItemInput): {
  productId: number
  name: string
  quantity: string | null
} {
  const parsed = parseQuantity(input.text)
  let name = capitalize(parsed.name)
  if (!name || name.length > 60) throw new HttpError(400, 'Name must be 1–60 characters')

  let productId: number
  if (input.productId !== undefined) {
    if (!get('SELECT 1 FROM products WHERE id = ?', input.productId))
      throw new HttpError(404, 'Unknown product')
    productId = input.productId
  } else if (input.catalogKey !== undefined) {
    productId = productForCatalog(input.catalogKey, name)
  } else {
    const match = recognise(buildTargets(listProducts()), parsed.name)
    if (match) name = match.label
    if (match?.target.productId) productId = match.target.productId
    else if (match?.target.catalogKey) productId = productForCatalog(match.target.catalogKey, name)
    else {
      const result = run(
        'INSERT INTO products (name, category, catalog_key, created_at) VALUES (?, ?, NULL, ?)',
        name,
        guessCategory(name),
        nowISO(),
      )
      productId = Number(result.lastInsertRowid)
    }
  }
  name = inEnglish(productId, name)
  // The product takes the most recent spelling, so suggestions use the words the household uses.
  run('UPDATE products SET name = ? WHERE id = ?', name, productId)
  return { productId, name, quantity: parsed.quantity }
}

/**
 * The app speaks English: a Dutch name of a known grocery ("Brood", "Appels") becomes its English
 * name. Dutch only helps to recognise what was meant.
 */
function inEnglish(productId: number, name: string): string {
  const row = get<{ catalogKey: string | null }>(
    'SELECT catalog_key AS catalogKey FROM products WHERE id = ?',
    productId,
  )
  const entry = catalogEntry(row?.catalogKey)
  if (!entry) return name
  const key = matchKey(name)
  const dutch = entry.nl.some((n) => matchKey(n) === key) && !entry.en.some((n) => matchKey(n) === key)
  return dutch ? capitalize(entry.en[0]) : name
}

/** Renames products and list items saved under a Dutch name, from before the app was English only. */
export function englishNames() {
  const products = all<{ id: number; name: string }>(
    'SELECT id, name FROM products WHERE catalog_key IS NOT NULL',
  )
  for (const { id, name } of products) {
    const english = inEnglish(id, name)
    if (english !== name) run('UPDATE products SET name = ? WHERE id = ?', english, id)
  }
  const items = all<{ id: number; productId: number; name: string }>(
    'SELECT id, product_id AS productId, name FROM items',
  )
  for (const { id, productId, name } of items) {
    const english = inEnglish(productId, name)
    if (english !== name) run('UPDATE items SET name = ? WHERE id = ?', english, id)
  }
}
