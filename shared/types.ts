import type { CategoryId } from './categories.ts'

/** Something on the shopping list. */
export interface Item {
  id: number
  productId: number
  /** The spelling it was added with, such as "Brood". */
  name: string
  quantity: string | null
  category: CategoryId
  addedAt: string
  /** When it was put in the basket, or null while it still needs getting. */
  inBasketAt: string | null
}

export interface AddItemInput {
  /** What was typed, possibly with a quantity ("2 melk"). */
  text: string
  /** Set when a suggestion was picked, so the server need not guess. */
  productId?: number
  catalogKey?: string
}

export interface ItemPatch {
  inBasket?: boolean
  quantity?: string | null
  name?: string
}

export interface ProductInput {
  name: string
  category: CategoryId
  /** Extra names it should be recognised by. */
  aliases: string[]
}

/** Anything the household has ever put on the list. */
export interface Product extends ProductInput {
  id: number
  catalogKey: string | null
  timesBought: number
  lastBought: string | null
  /** Typical number of days between shopping trips that included it. */
  intervalDays: number | null
}

export interface Suggestion {
  productId: number
  name: string
  category: CategoryId
  kind: 'due' | 'together'
  reason: string
}

export interface Settings {
  /** Minutes an item stays in the basket before it leaves the list, or null to keep it until cleared. */
  autoRemoveMinutes: number | null
  /** Group the list by store section, or keep it in the order things were added. */
  listOrder: 'section' | 'added'
  /** Show "you might need" suggestions from the purchase history. */
  showSuggestions: boolean
}

/** How much each clean-up in Settings would remove. */
export interface DataCounts {
  purchasesToday: number
  purchases: number
  items: number
  unusedProducts: number
  products: number
}

export type DataAction = 'clear-today' | 'clear-history' | 'clear-list' | 'forget-unused' | 'reset'

/** Adding something already on the list adds to it; this says what it was before, for undo. */
export interface AddResult extends Item {
  merged?: { quantity: string | null; inBasketAt: string | null }
}

/** Returned with a 409 when the product is already on the list in a way that can't be added up. */
export interface Duplicate {
  error: string
  itemId: number
}

/** A past shopping trip: everything that left the basket around the same time. */
export interface Trip {
  at: string
  products: { id: number; name: string; category: CategoryId }[]
}

/** Numbers and history for the desktop sidebar. */
export interface Overview {
  tripsThisWeek: number
  boughtThisMonth: number
  recentTrips: Trip[]
}
