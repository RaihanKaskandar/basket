import { all } from './db.ts'
import { loadTrips } from './history.ts'
import type { CategoryId } from '../shared/categories.ts'
import type { Overview } from '../shared/types.ts'

const RECENT_TRIPS = 4

/** Start of this week (Monday) and of this month, in the server's time zone. */
function periodStarts(now = new Date()) {
  const week = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const month = new Date(now.getFullYear(), now.getMonth(), 1)
  return { week: week.getTime(), month: month.getTime() }
}

export function overview(): Overview {
  const products = new Map(
    all<{ id: number; name: string; category: CategoryId }>('SELECT id, name, category FROM products').map(
      (p) => [p.id, p],
    ),
  )
  const trips = loadTrips()
  const { week, month } = periodStarts()
  return {
    tripsThisWeek: trips.filter((t) => t.at >= week).length,
    boughtThisMonth: trips.filter((t) => t.at >= month).reduce((sum, t) => sum + t.products.size, 0),
    recentTrips: trips
      .slice(-RECENT_TRIPS)
      .reverse()
      .map((trip) => ({
        at: new Date(trip.at).toISOString(),
        products: [...trip.products].flatMap((id) => products.get(id) ?? []),
      }))
      .filter((trip) => trip.products.length > 0),
  }
}
