import { categoryOf } from '../../shared/categories.ts'
import type { Item, Overview, Product, Suggestion, Trip } from '../../shared/types.ts'
import { oftenBought } from '../lists.ts'
import { CategoryIcon, CloseIcon, PlusIcon } from './bits.tsx'

interface Props {
  items: Item[]
  products: Product[]
  suggestions: Suggestion[]
  overview: Overview | null
  onAdd: (product: { id: number; name: string; category: Product['category'] }) => void
  onDismiss: (suggestion: Suggestion) => void
  onAddMany: (productIds: number[]) => void
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  )
}

function tripDate(at: string) {
  const date = new Date(at)
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function TripRow({
  trip,
  listed,
  onAddMany,
}: {
  trip: Trip
  listed: Set<number>
  onAddMany: Props['onAddMany']
}) {
  const missing = trip.products.filter((p) => !listed.has(p.id)).map((p) => p.id)
  return (
    <li className="trip">
      <div className="trip-head">
        <b>{tripDate(trip.at)}</b>
        <span className="muted">
          {trip.products.length} {trip.products.length === 1 ? 'item' : 'items'}
        </span>
        <span className="spacer" />
        <button className="btn small" disabled={missing.length === 0} onClick={() => onAddMany(missing)}>
          {missing.length === 0 ? 'All on list' : 'Add all again'}
        </button>
      </div>
      <p className="trip-items">
        {trip.products.map((p) => `${categoryOf(p.category).icon} ${p.name}`).join(' · ')}
      </p>
    </li>
  )
}

/** Desktop only: what the list page shows beside the list on a wide screen. */
export function Sidebar({ items, products, suggestions, overview, onAdd, onDismiss, onAddMany }: Props) {
  const listed = new Set(items.map((i) => i.productId))
  const toGet = items.filter((i) => !i.inBasketAt).length
  const staples = oftenBought(products, (p) => p.id, items, 8)

  return (
    <aside className="side">
      <section className="card side-card">
        <h3 className="group-title">At a glance</h3>
        <div className="stats">
          <Stat value={toGet} label="to get" />
          <Stat value={items.length - toGet} label="in basket" />
          <Stat value={overview?.tripsThisWeek ?? '–'} label="trips this week" />
          <Stat value={overview?.boughtThisMonth ?? '–'} label="bought this month" />
        </div>
      </section>

      {suggestions.length > 0 && (
        <section className="card side-card">
          <h3 className="group-title">You might need</h3>
          <ul className="side-list">
            {suggestions.map((s) => (
              <li key={s.productId} className="side-row">
                <CategoryIcon category={s.category} />
                <span className="side-row-text">
                  <b>{s.name}</b>
                  <small className="muted">{s.reason}</small>
                </span>
                <button
                  className="icon-btn small"
                  aria-label={`Add ${s.name}`}
                  onClick={() => onAdd({ id: s.productId, name: s.name, category: s.category })}
                >
                  <PlusIcon />
                </button>
                <button
                  className="icon-btn small ghost"
                  aria-label={`Not now: ${s.name}`}
                  onClick={() => onDismiss(s)}
                >
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {staples.length > 0 && (
        <section className="card side-card">
          <h3 className="group-title">Often bought</h3>
          <div className="chips">
            {staples.map((p) => (
              <button key={p.id} className="chip-btn" onClick={() => onAdd(p)}>
                <span aria-hidden="true">{categoryOf(p.category).icon}</span>
                {p.name}
                <PlusIcon />
              </button>
            ))}
          </div>
        </section>
      )}

      {overview && overview.recentTrips.length > 0 && (
        <section className="card side-card">
          <h3 className="group-title">Recent trips</h3>
          <ul className="side-list">
            {overview.recentTrips.map((trip) => (
              <TripRow key={trip.at} trip={trip} listed={listed} onAddMany={onAddMany} />
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}
