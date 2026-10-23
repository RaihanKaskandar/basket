import { getSettings } from './basket.ts'
import { all, get, run } from './db.ts'
import type { DataAction, DataCounts } from '../shared/types.ts'

const count = (sql: string, ...params: string[]) => get<{ n: number }>(sql, ...params)!.n

/** Midnight today in the server's time zone, as stored timestamps are written. */
const startOfToday = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

/** Products that were never bought and aren't on the list: added once, then forgotten. */
const UNUSED = `
  FROM products p
 WHERE NOT EXISTS (SELECT 1 FROM purchases WHERE product_id = p.id)
   AND NOT EXISTS (SELECT 1 FROM items WHERE product_id = p.id)`

export function dataCounts(): DataCounts {
  return {
    purchasesToday: count('SELECT COUNT(*) AS n FROM purchases WHERE bought_at >= ?', startOfToday()),
    purchases: count('SELECT COUNT(*) AS n FROM purchases'),
    items: count('SELECT COUNT(*) AS n FROM items'),
    unusedProducts: count(`SELECT COUNT(*) AS n ${UNUSED}`),
    products: count('SELECT COUNT(*) AS n FROM products'),
  }
}

export const DATA_ACTIONS: DataAction[] = [
  'clear-today',
  'clear-history',
  'clear-list',
  'forget-unused',
  'reset',
]

/** Runs one of the clean-ups from Settings and says how many things it removed. */
export function runDataAction(action: DataAction): number {
  switch (action) {
    case 'clear-today':
      return Number(run('DELETE FROM purchases WHERE bought_at >= ?', startOfToday()).changes)
    case 'clear-history':
      run('DELETE FROM snoozes')
      return Number(run('DELETE FROM purchases').changes)
    case 'clear-list':
      return Number(run('DELETE FROM items').changes)
    case 'forget-unused':
      return Number(run(`DELETE FROM products WHERE id IN (SELECT p.id ${UNUSED})`).changes)
    case 'reset':
      // Everything else hangs off products and goes with them (ON DELETE CASCADE). Settings stay.
      return Number(run('DELETE FROM products').changes)
  }
}

/** Everything in the database, for a backup file. */
export function exportData() {
  const aliases = all<{ productId: number; alias: string }>(
    'SELECT product_id AS productId, alias FROM aliases',
  )
  return {
    app: 'basket',
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    products: all<{ id: number }>(
      'SELECT id, name, category, catalog_key AS catalogKey, created_at AS createdAt FROM products',
    ).map((p) => ({ ...p, aliases: aliases.filter((a) => a.productId === p.id).map((a) => a.alias) })),
    items: all(
      'SELECT id, product_id AS productId, name, quantity, added_at AS addedAt, in_basket_at AS inBasketAt FROM items',
    ),
    purchases: all('SELECT product_id AS productId, quantity, bought_at AS boughtAt FROM purchases'),
  }
}
