import { useMemo, useState } from 'react'
import { CATALOG } from '../../shared/catalog.ts'
import { CATEGORIES } from '../../shared/categories.ts'
import type { CategoryId } from '../../shared/categories.ts'
import { buildTargets, capitalize, search } from '../../shared/match.ts'
import type { Item, Product } from '../../shared/types.ts'
import { PencilIcon, PlusIcon, SearchIcon } from './bits.tsx'

/** Something that can be put on the list: one of the household's products, or a catalog grocery. */
export interface CatalogEntry {
  name: string
  category: CategoryId
  productId: number | null
  catalogKey: string | null
}

interface Props {
  products: Product[]
  items: Item[]
  onAdd: (entry: CatalogEntry) => void
  onEdit: (product: Product) => void
}

const entryKey = (e: { productId: number | null; catalogKey: string | null }) =>
  e.productId ? `p${e.productId}` : `c${e.catalogKey}`

/** Every grocery Basket knows plus everything added by hand, by store section. */
export function CatalogView({ products, items, onAdd, onEdit }: Props) {
  const [query, setQuery] = useState('')
  const [section, setSection] = useState<CategoryId | null>(null)

  const entries = useMemo(() => {
    const linked = new Set(products.map((p) => p.catalogKey))
    const own: CatalogEntry[] = products.map((p) => ({
      name: p.name,
      category: p.category,
      productId: p.id,
      catalogKey: p.catalogKey,
    }))
    const rest: CatalogEntry[] = CATALOG.filter((c) => !linked.has(c.key)).map((c) => ({
      name: capitalize(c.en[0]),
      category: c.category,
      productId: null,
      catalogKey: c.key,
    }))
    return [...own, ...rest].sort((a, b) => a.name.localeCompare(b.name))
  }, [products])

  const targets = useMemo(() => buildTargets(products), [products])
  const byProduct = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const listed = new Map(items.map((i) => [i.productId, i]))

  // Searching keeps the best matches, in the same English/Dutch-aware way as adding.
  const found = query.trim() ? new Set(search(targets, query, 60).map((m) => entryKey(m.target))) : null
  const shown = entries.filter(
    (e) => (!found || found.has(entryKey(e))) && (!section || e.category === section),
  )
  const groups = CATEGORIES.map((c) => ({ ...c, entries: shown.filter((e) => e.category === c.id) })).filter(
    (g) => g.entries.length,
  )

  return (
    <main className="products">
      <div className="searchbar">
        <SearchIcon />
        <input
          className="addbar-input"
          value={query}
          placeholder="Search all products"
          aria-label="Search all products"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="sections" role="group" aria-label="Section">
        <button className="section-chip" aria-pressed={section === null} onClick={() => setSection(null)}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className="section-chip"
            aria-pressed={section === c.id}
            onClick={() => setSection(section === c.id ? null : c.id)}
          >
            <span aria-hidden="true">{c.icon}</span> {c.label}
          </button>
        ))}
      </div>

      {groups.length === 0 && <p className="empty">Nothing matches “{query}”. Add it from the list.</p>}

      {groups.map((group) => (
        <section key={group.id} className="catalog-group">
          <h3 className="group-title">
            <span aria-hidden="true">{group.icon}</span> {group.label}
            <span className="count">{group.entries.length}</span>
          </h3>
          <ul className="tiles">
            {group.entries.map((entry) => {
              const item = entry.productId ? listed.get(entry.productId) : undefined
              const product = entry.productId ? byProduct.get(entry.productId) : undefined
              return (
                <li key={entryKey(entry)} className={`tile${item ? ' on' : ''}`}>
                  <button
                    className="tile-add"
                    aria-label={item ? `Add one more ${entry.name}` : `Add ${entry.name}`}
                    onClick={() => onAdd(entry)}
                  >
                    <span className="tile-text">
                      <span className="tile-name">{entry.name}</span>
                      <span className="tile-meta">
                        {item
                          ? item.inBasketAt
                            ? 'In basket'
                            : `On list · ${item.quantity ?? 1}`
                          : product?.timesBought
                            ? `Bought ${product.timesBought}×`
                            : ''}
                      </span>
                    </span>
                    <span className="tile-plus">
                      <PlusIcon />
                    </span>
                  </button>
                  {product && (
                    <button
                      className="tile-edit"
                      aria-label={`Edit ${entry.name}`}
                      onClick={() => onEdit(product)}
                    >
                      <PencilIcon />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </main>
  )
}
