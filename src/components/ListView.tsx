import { useEffect, useRef } from 'react'
import { CATEGORIES } from '../../shared/categories.ts'
import { duration } from '../../shared/format.ts'
import type { Item } from '../../shared/types.ts'
import { CheckIcon, CloseIcon, TrashIcon } from './bits.tsx'
import { useSwipe } from './swipe.ts'

interface Props {
  items: Item[]
  now: number
  autoRemoveMinutes: number | null
  listOrder: 'section' | 'added'
  flashId: number | null
  onToggle: (item: Item) => void
  onOpen: (item: Item) => void
  onRemove: (item: Item) => void
  onClearBasket: () => void
}

function Row({
  item,
  flash,
  note,
  onToggle,
  onOpen,
  onRemove,
}: {
  item: Item
  flash: boolean
  note?: string
  onToggle: () => void
  onOpen: () => void
  onRemove: () => void
}) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (flash) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [flash])
  const inBasket = !!item.inBasketAt
  const swipe = useSwipe(onRemove, onToggle)
  const side = swipe.dx > 0 ? 'right' : swipe.dx < 0 ? 'left' : null
  return (
    <li ref={ref} className={`swipe-row${flash ? ' flash' : ''}`}>
      {/* What a swipe will do, revealed underneath the row as it slides. */}
      {side && (
        <div className={`swipe-action ${side}${swipe.armed ? ' armed' : ''}`} aria-hidden="true">
          {side === 'right' ? (
            <>
              <CheckIcon />
              {inBasket ? 'Back to list' : 'In basket'}
            </>
          ) : (
            <>
              Remove
              <TrashIcon />
            </>
          )}
        </div>
      )}
      <div
        className={`item${inBasket ? ' done' : ''}${swipe.state === 'dragging' ? ' dragging' : ''}`}
        style={swipe.dx ? { transform: `translateX(${swipe.dx}px)` } : undefined}
        {...swipe.handlers}
      >
        <button
          className="check"
          role="checkbox"
          aria-checked={inBasket}
          aria-label={inBasket ? `Take ${item.name} out of the basket` : `Put ${item.name} in the basket`}
          onClick={onToggle}
        >
          <CheckIcon />
        </button>
        <button className="item-main" onClick={onOpen}>
          <span className="item-name">{item.name}</span>
          {item.quantity && <span className="qty">{item.quantity}</span>}
          {note && <span className="item-note">{note}</span>}
        </button>
        <button className="item-remove" aria-label={`Remove ${item.name}`} onClick={onRemove}>
          <CloseIcon />
        </button>
      </div>
    </li>
  )
}

function leavesIn(item: Item, now: number, minutes: number | null) {
  if (minutes === null || !item.inBasketAt) return undefined
  const left = Math.ceil((Date.parse(item.inBasketAt) + minutes * 60_000 - now) / 60_000)
  return left <= 1 ? 'leaving now' : `leaves in ${duration(left)}`
}

export function ListView({
  items,
  now,
  autoRemoveMinutes,
  listOrder,
  flashId,
  onToggle,
  onOpen,
  onRemove,
  onClearBasket,
}: Props) {
  const toGet = items.filter((i) => !i.inBasketAt)
  const basket = items.filter((i) => i.inBasketAt).sort((a, b) => b.inBasketAt!.localeCompare(a.inBasketAt!))
  // By section groups the list as the store is laid out; otherwise it is one list, oldest first.
  const groups =
    listOrder === 'added'
      ? [{ id: 'all', icon: '', label: '', items: toGet }].filter((g) => g.items.length)
      : CATEGORIES.map((c) => ({ ...c, items: toGet.filter((i) => i.category === c.id) })).filter(
          (g) => g.items.length,
        )

  if (items.length === 0) {
    return (
      <div className="card empty-state">
        <span className="empty-mark">🧺</span>
        <h2>The list is empty</h2>
        <p className="muted">Type above to add groceries.</p>
      </div>
    )
  }

  return (
    <>
      {groups.length > 0 ? (
        <div className="card list">
          {groups.map((group) => (
            <section key={group.id} className="group">
              {group.label && (
                <h3 className="group-title">
                  <span aria-hidden="true">{group.icon}</span> {group.label}
                </h3>
              )}
              <ul>
                {group.items.map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    flash={item.id === flashId}
                    onToggle={() => onToggle(item)}
                    onOpen={() => onOpen(item)}
                    onRemove={() => onRemove(item)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="card empty-state small">
          <span className="empty-mark">🎉</span>
          <h2>Everything is in the basket</h2>
        </div>
      )}

      {basket.length > 0 && (
        <div className="card list basket">
          <div className="basket-head">
            <h3 className="group-title">
              <span aria-hidden="true">🧺</span> In basket <span className="count">{basket.length}</span>
            </h3>
            <button className="btn small" onClick={onClearBasket}>
              Clear basket
            </button>
          </div>
          <ul>
            {basket.map((item) => (
              <Row
                key={item.id}
                item={item}
                flash={item.id === flashId}
                note={leavesIn(item, now, autoRemoveMinutes)}
                onToggle={() => onToggle(item)}
                onOpen={() => onOpen(item)}
                onRemove={() => onRemove(item)}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
