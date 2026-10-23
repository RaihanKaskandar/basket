import { all, nowISO } from './db.ts'
import { DAY, loadTrips, productStats } from './history.ts'
import type { CategoryId } from '../shared/categories.ts'
import { ago, every } from '../shared/format.ts'
import { capitalize } from '../shared/match.ts'
import type { Suggestion } from '../shared/types.ts'

const MAX = 8
/** Suggest something once this share of its usual interval has passed. */
const DUE_RATIO = 0.85
/** Bought together on at least this many trips, and on this share of the trips with the other product. */
const TOGETHER_TRIPS = 2
const TOGETHER_SHARE = 0.4

/** Things that are probably running out, and things usually bought alongside what is on the list. */
export function suggestions(): Suggestion[] {
  const products = new Map(
    all<{ id: number; name: string; category: CategoryId }>('SELECT id, name, category FROM products').map(
      (p) => [p.id, p],
    ),
  )
  const onList = new Set(all<{ id: number }>('SELECT product_id AS id FROM items').map((r) => r.id))
  const snoozed = new Set(
    all<{ id: number }>('SELECT product_id AS id FROM snoozes WHERE until > ?', nowISO()).map((r) => r.id),
  )
  const open = (id: number) => products.has(id) && !onList.has(id) && !snoozed.has(id)

  const trips = loadTrips()
  const stats = productStats(trips)
  const now = Date.now()

  const due: (Suggestion & { score: number })[] = []
  for (const [id, s] of stats) {
    if (!s.intervalDays || !open(id)) continue
    const elapsed = (now - s.last) / DAY
    const score = elapsed / s.intervalDays
    if (score < DUE_RATIO) continue
    const { name, category } = products.get(id)!
    const reason = `${capitalize(every(s.intervalDays))} · ${ago(elapsed)}`
    due.push({ productId: id, name, category, kind: 'due', reason, score })
  }
  due.sort((a, b) => b.score - a.score)

  const together = new Map<number, Suggestion & { score: number }>()
  for (const listed of onList) {
    const withListed = trips.filter((t) => t.products.has(listed))
    if (withListed.length < TOGETHER_TRIPS) continue
    const counts = new Map<number, number>()
    for (const trip of withListed) {
      for (const id of trip.products) if (id !== listed) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    for (const [id, count] of counts) {
      const score = count / withListed.length
      if (count < TOGETHER_TRIPS || score < TOGETHER_SHARE || !open(id)) continue
      if (due.some((d) => d.productId === id) || (together.get(id)?.score ?? 0) >= score) continue
      const { name, category } = products.get(id)!
      const reason = `Often bought with ${products.get(listed)!.name.toLowerCase()}`
      together.set(id, { productId: id, name, category, kind: 'together', reason, score })
    }
  }
  const pairs = [...together.values()].sort((a, b) => b.score - a.score)

  // Mostly what is running out, but keep room for a couple of "bought together" ideas.
  const picked = [...due.slice(0, MAX - Math.min(2, pairs.length)), ...pairs].slice(0, MAX)
  return picked.map(({ score: _score, ...suggestion }) => suggestion)
}
