import { useState } from 'react'
import type { FormEvent } from 'react'
import { stepAmount } from '../../shared/amount.ts'
import type { Item, ItemPatch } from '../../shared/types.ts'
import { MinusIcon, PlusIcon } from './bits.tsx'

const QUICK = ['1', '2', '3', '4', '6', '10']

interface Props {
  item: Item
  onSave: (patch: ItemPatch) => void
  onDelete: () => void
  onClose: () => void
}

export function ItemSheet({ item, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(item.quantity ?? '')

  const current = quantity.trim() || null
  const up = stepAmount(current, 1)
  // Nothing below one; an empty field already means one.
  const down = current === null ? undefined : stepAmount(current, -1)

  function submit(event: FormEvent) {
    event.preventDefault()
    const patch: ItemPatch = {}
    if (name.trim() && name.trim() !== item.name) patch.name = name.trim()
    if ((quantity.trim() || null) !== item.quantity) patch.quantity = quantity.trim() || null
    if (Object.keys(patch).length) onSave(patch)
    onClose()
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="item-title" onSubmit={submit}>
        <h2 id="item-title">{item.name}</h2>

        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="field">
          <label className="field-label" htmlFor="item-qty">
            How many
          </label>
          <div className="stepper">
            <button
              type="button"
              className="icon-btn"
              aria-label="One less"
              disabled={down === undefined}
              onClick={() => setQuantity(down ?? '')}
            >
              <MinusIcon />
            </button>
            <input
              id="item-qty"
              className="input"
              value={quantity}
              maxLength={30}
              placeholder="1"
              onChange={(e) => setQuantity(e.target.value)}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label="One more"
              disabled={up === undefined}
              onClick={() => setQuantity(up ?? '')}
            >
              <PlusIcon />
            </button>
          </div>
          <span className="hint">A number, or an amount such as 500 g or 2 packs.</span>
          <div className="presets">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                className="preset"
                aria-pressed={quantity === q}
                onClick={() => setQuantity(quantity === q ? '' : q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-actions">
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              onDelete()
              onClose()
            }}
          >
            Remove
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Save
          </button>
        </div>
      </form>
    </div>
  )
}
