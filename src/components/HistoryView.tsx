import { useMemo, useState } from 'react'
import { ago, every } from '../../shared/format.ts'
import { buildTargets, search } from '../../shared/match.ts'
import type { Item, Overview, Product } from '../../shared/types.ts'
import { CategoryIcon, PlusIcon, SearchIcon } from './bits.tsx'
import { TripRow } from './Sidebar.tsx'

interface Props {
  products: Product[]
  items: Item[]
  overview: Overview | null
  onOpen: (product: Product) => void
  onAdd: (product: Product) => void
  onAddMany: (productIds: number[]) => void
}

function describe(product: Product) {
  if (!product.lastBought) return ''
  const parts = [`${product.timesBought}×`]
  if (product.intervalDays) parts.push(every(product.intervalDays))
  parts.push(`${ago((Date.now() - Date.parse(product.lastBought)) / 86_400_000)}`)
  return parts.join(' · ')
}

/** Recent shopping trips, and everything bought before with how often it is bought. */
export function HistoryView({ products, items, overview, onOpen, onAdd, onAddMany }: Props) {
  const [query, setQuery] = useState('')
  const bought = useMemo(() => products.filter((p) => p.timesBought > 0), [products])
  const targets = useMemo(() => buildTargets(bought), [bought])
  const listed = new Set(items.map((i) => i.productId))
  const trips = overview?.recentTrips ?? []

  const shown = query.trim()
    ? search(targets, query, 50).map((m) => bought.find((p) => p.id === m.target.productId)!)
    : bought

  if (bought.length === 0) {
    return (
      <main className="products">
        <div className="card empty-state">
          <span className="empty-mark">🧾</span>
          <h2>Nothing bought yet</h2>
          <p className="muted">
            Things show up here once they leave the basket, with how often you buy them.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="products">
      {trips.length > 0 && !query.trim() && (
        <section className="card side-card">
          <h3 className="group-title">Recent trips</h3>
          <ul className="side-list">
            {trips.map((trip) => (
              <TripRow key={trip.at} trip={trip} listed={listed} onAddMany={onAddMany} />
            ))}
          </ul>
        </section>
      )}

      <div className="searchbar">
        <SearchIcon />
        <input
          className="addbar-input"
          value={query}
          placeholder="Search what you've bought"
          aria-label="Search what you've bought"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {shown.length === 0 ? (
        <p className="empty">Nothing matches “{query}”.</p>
      ) : (
        <ul className="card list product-list">
          {shown.map((product) => (
            <li key={product.id} className="product">
              <button className="product-main" onClick={() => onOpen(product)}>
                <CategoryIcon category={product.category} />
                <span className="product-text">
                  <b>{product.name}</b>
                  <small className="muted">{describe(product)}</small>
                </span>
              </button>
              {listed.has(product.id) ? (
                <span className="pill">On list</span>
              ) : (
                <button
                  className="icon-btn"
                  aria-label={`Add ${product.name} to the list`}
                  onClick={() => onAdd(product)}
                >
                  <PlusIcon />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
