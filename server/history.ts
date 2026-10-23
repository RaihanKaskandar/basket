import { all } from './db.ts'

export const DAY = 24 * 60 * 60 * 1000
/** Purchases closer together than this count as one shopping trip. */
const TRIP_GAP = 3 * 60 * 60 * 1000
/** Trips on the same day don't say anything about how often something runs out. */
const MIN_INTERVAL = 0.5 * DAY

export interface Trip {
  at: number
  products: Set<number>
}

export interface Stats {
  /** Number of trips it was bought on. */
  times: number
  last: number
  /** Median days between trips that included it, once it was bought at least twice. */
  intervalDays: number | null
}

/** Groups every purchase into shopping trips, oldest first. */
export function loadTrips(): Trip[] {
  const purchases = all<{ productId: number; boughtAt: string }>(
    'SELECT product_id AS productId, bought_at AS boughtAt FROM purchases ORDER BY bought_at',
  )
  const trips: Trip[] = []
  let lastAt = -Infinity
  for (const { productId, boughtAt } of purchases) {
    const at = Date.parse(boughtAt)
    if (at - lastAt > TRIP_GAP) trips.push({ at, products: new Set() })
    trips[trips.length - 1].products.add(productId)
    lastAt = at
  }
  return trips
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function productStats(trips: Trip[]): Map<number, Stats> {
  const times = new Map<number, number[]>()
  for (const trip of trips) {
    for (const id of trip.products) {
      const list = times.get(id)
      if (list) list.push(trip.at)
      else times.set(id, [trip.at])
    }
  }
  const stats = new Map<number, Stats>()
  for (const [id, list] of times) {
    const gaps: number[] = []
    for (let i = 1; i < list.length; i++) {
      const gap = list[i] - list[i - 1]
      if (gap >= MIN_INTERVAL) gaps.push(gap / DAY)
    }
    stats.set(id, {
      times: list.length,
      last: list[list.length - 1],
      intervalDays: gaps.length ? Math.round(median(gaps) * 10) / 10 : null,
    })
  }
  return stats
}
