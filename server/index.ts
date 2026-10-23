import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { clearBasket, getSettings, MAX_MINUTES, saveSettings, startSweeper, sweep } from './basket.ts'
import { DATA_ACTIONS, dataCounts, exportData, runDataAction } from './data.ts'
import { all, get, nowISO, run, transaction } from './db.ts'
import { changed, events } from './events.ts'
import { HttpError, parseId } from './http.ts'
import { englishNames, listProducts, resolveItem } from './products.ts'
import { overview } from './overview.ts'
import { suggestions } from './suggest.ts'
import { addAmounts } from '../shared/amount.ts'
import { isCategory } from '../shared/categories.ts'
import { normalize } from '../shared/match.ts'
import type { AddItemInput, AddResult, DataAction, Item, ProductInput, Settings } from '../shared/types.ts'

const ITEM_SELECT = `
  SELECT i.id, i.product_id AS productId, i.name, i.quantity, p.category,
         i.added_at AS addedAt, i.in_basket_at AS inBasketAt
    FROM items i JOIN products p ON p.id = i.product_id`

const getItem = (id: number) => get<Item>(`${ITEM_SELECT} WHERE i.id = ?`, id)

function parseQuantityField(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || value.trim().length > 30) {
    throw new HttpError(400, 'Quantity can be at most 30 characters')
  }
  return value.trim() || null
}

function parseAddItem(body: unknown): AddItemInput {
  const input = (body ?? {}) as Record<string, unknown>
  const text = typeof input.text === 'string' ? input.text.trim() : ''
  if (!text || text.length > 80) throw new HttpError(400, 'Type what you need')
  const { productId, catalogKey } = input
  if (productId !== undefined && (typeof productId !== 'number' || !Number.isInteger(productId))) {
    throw new HttpError(400, 'Invalid product')
  }
  if (catalogKey !== undefined && typeof catalogKey !== 'string') throw new HttpError(400, 'Invalid product')
  return { text, productId, catalogKey }
}

function parseProduct(body: unknown): ProductInput {
  const input = (body ?? {}) as Record<string, unknown>
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > 60) throw new HttpError(400, 'Name must be 1–60 characters')
  if (!isCategory(input.category)) throw new HttpError(400, 'Pick a section')
  if (!Array.isArray(input.aliases) || input.aliases.length > 20)
    throw new HttpError(400, 'Too many other names')
  const aliases: string[] = []
  for (const alias of input.aliases) {
    const text = typeof alias === 'string' ? alias.trim().toLowerCase() : ''
    if (!text || text.length > 40) throw new HttpError(400, 'Other names must be 1–40 characters')
    if (!aliases.some((a) => normalize(a) === normalize(text))) aliases.push(text)
  }
  return { name, category: input.category, aliases }
}

function parseSettings(body: unknown): Settings {
  const { autoRemoveMinutes, listOrder, showSuggestions } = (body ?? {}) as Record<string, unknown>
  if (
    autoRemoveMinutes !== null &&
    (typeof autoRemoveMinutes !== 'number' ||
      !Number.isInteger(autoRemoveMinutes) ||
      autoRemoveMinutes < 1 ||
      autoRemoveMinutes > MAX_MINUTES)
  ) {
    throw new HttpError(400, 'Pick between 1 minute and 7 days')
  }
  if (listOrder !== 'section' && listOrder !== 'added') throw new HttpError(400, 'Pick a list order')
  if (typeof showSuggestions !== 'boolean') throw new HttpError(400, 'Invalid suggestions setting')
  return { autoRemoveMinutes, listOrder, showSuggestions }
}

/** Runs a change in a transaction, then lets every open app know. */
function change<T>(fn: () => T): T {
  const result = transaction(fn)
  changed()
  return result
}

transaction(englishNames)
startSweeper()

const app = express()
app.use(express.json())

app.get('/api/events', events)

app.get('/api/items', (_req, res) => {
  // Catch anything that expired since the last sweep, so the list is never stale.
  if (transaction(sweep) > 0) changed()
  res.json(all<Item>(`${ITEM_SELECT} ORDER BY i.added_at, i.id`))
})

app.post('/api/items', (req, res) => {
  const input = parseAddItem(req.body)
  const item = change((): AddResult | undefined => {
    const { productId, name, quantity } = resolveItem(input)
    const existing = get<{ id: number; name: string; quantity: string | null; inBasketAt: string | null }>(
      'SELECT id, name, quantity, in_basket_at AS inBasketAt FROM items WHERE product_id = ?',
      productId,
    )
    if (existing) {
      const merged = { quantity: existing.quantity, inBasketAt: existing.inBasketAt }
      if (existing.inBasketAt) {
        // Already bought, so this is needed again: back on the list with the new amount.
        run('UPDATE items SET in_basket_at = NULL, quantity = ? WHERE id = ?', quantity, existing.id)
        return { ...getItem(existing.id)!, merged }
      }
      const total = addAmounts(existing.quantity, quantity)
      if (total === undefined) {
        throw new HttpError(409, `${existing.name} is already on the list (${existing.quantity})`, {
          itemId: existing.id,
        })
      }
      run('UPDATE items SET quantity = ? WHERE id = ?', total, existing.id)
      return { ...getItem(existing.id)!, merged }
    }
    const result = run(
      'INSERT INTO items (product_id, name, quantity, added_at) VALUES (?, ?, ?, ?)',
      productId,
      name,
      quantity,
      nowISO(),
    )
    return getItem(Number(result.lastInsertRowid))
  })
  res.status(item && 'merged' in item ? 200 : 201).json(item)
})

app.post('/api/items/many', (req, res) => {
  const { productIds } = (req.body ?? {}) as Record<string, unknown>
  if (!Array.isArray(productIds) || productIds.length > 100 || !productIds.every(Number.isInteger)) {
    throw new HttpError(400, 'Invalid products')
  }
  const added = change(() => {
    let count = 0
    for (const productId of new Set(productIds as number[])) {
      const product = get<{ name: string }>('SELECT name FROM products WHERE id = ?', productId)
      // Gone, or already on the list: nothing to add.
      if (!product || get('SELECT 1 FROM items WHERE product_id = ?', productId)) continue
      run(
        'INSERT INTO items (product_id, name, quantity, added_at) VALUES (?, ?, NULL, ?)',
        productId,
        product.name,
        nowISO(),
      )
      count++
    }
    return count
  })
  res.status(201).json({ added })
})

app.patch('/api/items/:id', (req, res) => {
  const id = parseId(req.params.id)
  const { inBasket, quantity, name } = (req.body ?? {}) as Record<string, unknown>
  const item = change(() => {
    if (!getItem(id)) throw new HttpError(404, 'That item is no longer on the list')
    if (inBasket !== undefined) {
      if (typeof inBasket !== 'boolean') throw new HttpError(400, 'Invalid basket state')
      run('UPDATE items SET in_basket_at = ? WHERE id = ?', inBasket ? nowISO() : null, id)
    }
    if (quantity !== undefined)
      run('UPDATE items SET quantity = ? WHERE id = ?', parseQuantityField(quantity), id)
    if (name !== undefined) {
      const text = typeof name === 'string' ? name.trim() : ''
      if (!text || text.length > 60) throw new HttpError(400, 'Name must be 1–60 characters')
      run('UPDATE items SET name = ? WHERE id = ?', text, id)
    }
    return getItem(id)
  })
  res.json(item)
})

app.delete('/api/items/:id', (req, res) => {
  const id = parseId(req.params.id)
  const item = change(() => {
    const item = getItem(id)
    if (!item) throw new HttpError(404, 'That item is no longer on the list')
    run('DELETE FROM items WHERE id = ?', id)
    return item
  })
  // Sent back so the app can offer to undo.
  res.json(item)
})

app.post('/api/basket/clear', (_req, res) => {
  change(clearBasket)
  res.status(204).end()
})

app.get('/api/products', (_req, res) => {
  res.json(listProducts())
})

app.put('/api/products/:id', (req, res) => {
  const id = parseId(req.params.id)
  const input = parseProduct(req.body)
  change(() => {
    if (!get('SELECT 1 FROM products WHERE id = ?', id)) throw new HttpError(404, 'Product not found')
    run('UPDATE products SET name = ?, category = ? WHERE id = ?', input.name, input.category, id)
    run('DELETE FROM aliases WHERE product_id = ?', id)
    for (const alias of input.aliases) run('INSERT INTO aliases (product_id, alias) VALUES (?, ?)', id, alias)
  })
  res.json(listProducts().find((p) => p.id === id))
})

app.delete('/api/products/:id', (req, res) => {
  const id = parseId(req.params.id)
  change(() => {
    // Also removes it from the list and forgets its history, through ON DELETE CASCADE.
    if (!run('DELETE FROM products WHERE id = ?', id).changes) throw new HttpError(404, 'Product not found')
  })
  res.status(204).end()
})

app.get('/api/overview', (_req, res) => {
  res.json(overview())
})

app.get('/api/suggestions', (_req, res) => {
  res.json(suggestions())
})

app.post('/api/suggestions/:productId/snooze', (req, res) => {
  const id = parseId(req.params.productId)
  change(() => {
    if (!get('SELECT 1 FROM products WHERE id = ?', id)) throw new HttpError(404, 'Product not found')
    const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    run(
      'INSERT INTO snoozes (product_id, until) VALUES (?, ?) ON CONFLICT (product_id) DO UPDATE SET until = excluded.until',
      id,
      until,
    )
  })
  res.status(204).end()
})

app.get('/api/settings', (_req, res) => {
  res.json(getSettings())
})

app.put('/api/settings', (req, res) => {
  const settings = parseSettings(req.body)
  change(() => {
    saveSettings(settings)
    sweep()
  })
  res.json(getSettings())
})

app.get('/api/data', (_req, res) => {
  res.json(dataCounts())
})

app.post('/api/data/:action', (req, res) => {
  const action = req.params.action as DataAction
  if (!DATA_ACTIONS.includes(action)) throw new HttpError(404, 'Unknown action')
  const removed = change(() => runDataAction(action))
  res.json({ removed })
})

app.get('/api/export', (_req, res) => {
  const date = new Date().toISOString().slice(0, 10)
  res.setHeader('Content-Disposition', `attachment; filename="basket-backup-${date}.json"`)
  res.json(exportData())
})

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')))

// Serve the built front end, if there is one (`npm run build`).
const dist = resolve('dist')
if (existsSync(dist)) app.use(express.static(dist))

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = error instanceof HttpError ? error.status : 500
  if (status === 500) console.error(error)
  const data = error instanceof HttpError ? error.data : {}
  res
    .status(status)
    .json({ ...data, error: status === 500 ? 'Something went wrong' : (error as Error).message })
})

const port = Number(process.env.PORT ?? 3002)
app.listen(port, () => console.log(`Basket listening on http://localhost:${port}`))
