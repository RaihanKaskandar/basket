import { useState } from 'react'
import type { FormEvent } from 'react'
import { catalogEntry } from '../../shared/catalog.ts'
import { CATEGORIES } from '../../shared/categories.ts'
import type { CategoryId } from '../../shared/categories.ts'
import type { Product, ProductInput } from '../../shared/types.ts'
import { CloseIcon, PlusIcon } from './bits.tsx'

interface Props {
  product: Product
  onSave: (input: ProductInput) => Promise<boolean>
  onForget: () => Promise<boolean>
  onClose: () => void
}

export function ProductSheet({ product, onSave, onForget, onClose }: Props) {
  const [name, setName] = useState(product.name)
  const [category, setCategory] = useState<CategoryId>(product.category)
  const [aliases, setAliases] = useState(product.aliases)
  const [alias, setAlias] = useState('')
  const entry = catalogEntry(product.catalogKey)
  const known = entry ? [...entry.en, ...entry.nl] : []

  function addAlias() {
    const text = alias.trim().toLowerCase()
    if (text && !aliases.includes(text)) setAliases([...aliases, text])
    setAlias('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (await onSave({ name: name.trim(), category, aliases })) onClose()
  }

  async function forget() {
    const ok = window.confirm(
      `Forget ${product.name}? It is taken off the list and its purchase history is deleted.`,
    )
    if (ok && (await onForget())) onClose()
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-title"
        onSubmit={submit}
      >
        <h2 id="product-title">{product.name}</h2>

        <label className="field">
          <span className="field-label">Name</span>
          <input
            className="input"
            value={name}
            maxLength={60}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="field">
          <span className="field-label">Section</span>
          <div className="category-grid" role="radiogroup" aria-label="Section">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={category === c.id}
                className="category-choice"
                onClick={() => setCategory(c.id)}
              >
                <span aria-hidden="true">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Also recognised as</span>
          {known.length > 0 && (
            <div className="chips">
              {known.map((n) => (
                <span key={n} className="chip">
                  {n}
                </span>
              ))}
            </div>
          )}
          {aliases.length > 0 && (
            <div className="chips">
              {aliases.map((a) => (
                <span key={a} className="chip own">
                  {a}
                  <button
                    type="button"
                    aria-label={`Remove ${a}`}
                    onClick={() => setAliases(aliases.filter((x) => x !== a))}
                  >
                    <CloseIcon />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="add-alias">
            <input
              className="input"
              value={alias}
              maxLength={40}
              placeholder="Add another name"
              onChange={(e) => setAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addAlias()
                }
              }}
            />
            <button type="button" className="btn" disabled={!alias.trim()} onClick={addAlias}>
              <PlusIcon />
              Add
            </button>
          </div>
          <span className="hint">Typing any of these names finds this product.</span>
        </div>

        <div className="sheet-actions">
          <button type="button" className="btn danger" onClick={() => void forget()}>
            Forget
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!name.trim()}>
            Save
          </button>
        </div>
      </form>
    </div>
  )
}
