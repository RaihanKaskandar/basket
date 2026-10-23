import type { Suggestion } from '../../shared/types.ts'
import { CategoryIcon, CloseIcon } from './bits.tsx'

interface Props {
  suggestions: Suggestion[]
  onAdd: (suggestion: Suggestion) => void
  onDismiss: (suggestion: Suggestion) => void
}

/** Things that are probably running out, from the purchase history. */
export function Suggestions({ suggestions, onAdd, onDismiss }: Props) {
  if (suggestions.length === 0) return null
  return (
    <section className="suggestions" aria-label="Suggestions">
      <h3 className="eyebrow">You might need</h3>
      <ul className="suggestion-row">
        {suggestions.map((s) => (
          <li key={s.productId} className="suggestion">
            <button className="suggestion-add" onClick={() => onAdd(s)}>
              <CategoryIcon category={s.category} />
              <span className="suggestion-text">
                <b>{s.name}</b>
                <small>{s.reason}</small>
              </span>
            </button>
            <button
              className="suggestion-dismiss"
              aria-label={`Not now: ${s.name}`}
              onClick={() => onDismiss(s)}
            >
              <CloseIcon />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
