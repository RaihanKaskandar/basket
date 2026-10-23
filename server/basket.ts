import { all, getMeta, run, setMeta, transaction } from './db.ts'
import { changed } from './events.ts'
import type { Settings } from '../shared/types.ts'

const DEFAULT_MINUTES = 60
export const MAX_MINUTES = 7 * 24 * 60

export function getSettings(): Settings {
  const stored = getMeta('auto_remove_minutes')
  const minutes = Number(stored)
  return {
    autoRemoveMinutes:
      stored === 'never' ? null : Number.isInteger(minutes) && minutes > 0 ? minutes : DEFAULT_MINUTES,
    listOrder: getMeta('list_order') === 'added' ? 'added' : 'section',
    showSuggestions: getMeta('show_suggestions') !== 'no',
  }
}

export function saveSettings(settings: Settings) {
  setMeta(
    'auto_remove_minutes',
    settings.autoRemoveMinutes === null ? 'never' : String(settings.autoRemoveMinutes),
  )
  setMeta('list_order', settings.listOrder)
  setMeta('show_suggestions', settings.showSuggestions ? 'yes' : 'no')
}

/**
 * Takes items out of the basket and off the list, and remembers them as bought.
 * They count as bought when they went into the basket, which is when the shopping happened.
 */
function finalize(where: string, ...params: string[]) {
  const ids = all<{ id: number; productId: number }>(
    `SELECT id, product_id AS productId FROM items WHERE in_basket_at IS NOT NULL ${where}`,
    ...params,
  )
  for (const { id, productId } of ids) {
    run(
      'INSERT INTO purchases (product_id, quantity, bought_at) SELECT product_id, quantity, in_basket_at FROM items WHERE id = ?',
      id,
    )
    run('DELETE FROM items WHERE id = ?', id)
    // Buying something ends a snoozed suggestion for it.
    run('DELETE FROM snoozes WHERE product_id = ?', productId)
  }
  return ids.length
}

export const clearBasket = () => finalize('')

/** Removes items that have been in the basket for longer than the setting allows. */
export function sweep(): number {
  const { autoRemoveMinutes } = getSettings()
  if (autoRemoveMinutes === null) return 0
  const cutoff = new Date(Date.now() - autoRemoveMinutes * 60_000).toISOString()
  return finalize('AND in_basket_at <= ?', cutoff)
}

/** Sweeps now and then, and tells open apps when something left the list. */
export function startSweeper() {
  const tick = () => {
    if (transaction(sweep) > 0) changed()
  }
  tick()
  setInterval(tick, 30_000).unref()
}
