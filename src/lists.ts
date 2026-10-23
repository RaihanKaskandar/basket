import type { Item } from '../shared/types.ts'

/** The most-bought things that aren't on the list yet: staples worth one-tap adding. */
export function oftenBought<T extends { timesBought: number }>(
  candidates: T[],
  idOf: (candidate: T) => number | null,
  items: Item[],
  limit: number,
): T[] {
  const listed = new Set(items.map((i) => i.productId))
  return candidates
    .filter((c) => {
      const id = idOf(c)
      return id !== null && c.timesBought > 0 && !listed.has(id)
    })
    .sort((a, b) => b.timesBought - a.timesBought)
    .slice(0, limit)
}
