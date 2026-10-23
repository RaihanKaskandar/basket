import { useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import type { CategoryId } from '../../shared/categories.ts'
import { capitalize, guessCategory, parseQuantity, LIKELY, search, STRONG } from '../../shared/match.ts'
import type { Match, Target } from '../../shared/match.ts'
import type { AddItemInput, Item } from '../../shared/types.ts'
import { oftenBought } from '../lists.ts'
import { CategoryIcon, PlusIcon } from './bits.tsx'

/** What to add, plus enough to show it on the list before the server answers. */
export interface AddChoice {
  input: AddItemInput
  name: string
  quantity: string | null
  category: CategoryId
}

type Option = { kind: 'match'; match: Match } | { kind: 'new'; name: string }

interface Props {
  targets: Target[]
  items: Item[]
  onAdd: (choice: AddChoice) => void
}

export function AddBar({ targets, items, onAdd }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  const parsed = parseQuantity(text)
  const listed = useMemo(() => new Map(items.map((i) => [i.productId, i])), [items])

  const options = useMemo((): Option[] => {
    if (!text.trim()) {
      // Nothing typed yet: offer what is bought most and isn't on the list.
      return oftenBought(targets, (t) => t.productId, items, 6).map((target) => ({
        kind: 'match',
        match: { target, label: target.name, score: 0 },
      }))
    }
    const matches: Option[] = search(targets, parsed.name, 6).map((match) => ({ kind: 'match', match }))
    const top = matches[0]?.kind === 'match' ? matches[0].match.score : 0
    if (top >= STRONG) return matches
    // A likely match ("bre" for bread) is picked by Enter; otherwise what was typed comes first.
    const typed: Option = { kind: 'new', name: capitalize(parsed.name) }
    return top >= LIKELY ? [...matches, typed] : [typed, ...matches]
  }, [text, parsed.name, targets, items])

  function choose(option: Option) {
    const { quantity } = parsed
    if (option.kind === 'new') {
      onAdd({ input: { text }, name: option.name, quantity, category: guessCategory(option.name) })
    } else {
      const { target, label } = option.match
      const prefix = text.trim() ? quantity : null
      onAdd({
        input: {
          text: prefix ? `${prefix} ${label}` : label,
          ...(target.productId ? { productId: target.productId } : { catalogKey: target.catalogKey! }),
        },
        name: label,
        quantity: prefix,
        category: target.category,
      })
    }
    setText('')
    setActive(0)
    input.current?.focus()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    const option = options[active] ?? options[0]
    if (option) choose(option)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (options.length ? (i + step + options.length) % options.length : 0))
    } else if (event.key === 'Escape') {
      if (text) setText('')
      else setOpen(false)
    }
  }

  const showList = open && options.length > 0

  return (
    <form className="addbar" onSubmit={submit} role="search">
      <div className="addbar-field">
        <PlusIcon />
        <input
          ref={input}
          className="addbar-input"
          value={text}
          placeholder="Add milk, 2 apples, bread…"
          aria-label="Add to the list"
          role="combobox"
          aria-expanded={showList}
          aria-controls="addbar-options"
          aria-autocomplete="list"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          spellCheck={false}
          enterKeyHint="enter"
          maxLength={80}
          onChange={(e) => {
            setText(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {text && (
          <button type="submit" className="btn primary addbar-submit">
            Add
          </button>
        )}
      </div>

      {showList && (
        <ul className="options card" id="addbar-options" role="listbox">
          {!text.trim() && <li className="options-title">Often bought</li>}
          {options.map((option, i) => {
            const onList = option.kind === 'match' && option.match.target.productId
            const item = onList ? listed.get(option.match.target.productId!) : undefined
            return (
              <li
                key={
                  option.kind === 'new'
                    ? 'new'
                    : `${option.match.target.productId}-${option.match.target.catalogKey}`
                }
                role="option"
                aria-selected={i === active}
                className="option"
                // Keep the keyboard open: choosing must not take focus from the input.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(option)}
              >
                {option.kind === 'new' ? (
                  <>
                    <span className="option-plus">
                      <PlusIcon />
                    </span>
                    <span className="option-text">
                      Add <b>{option.name}</b>
                    </span>
                  </>
                ) : (
                  <>
                    <CategoryIcon category={option.match.target.category} />
                    <span className="option-text">
                      <b>{option.match.label}</b>
                    </span>
                  </>
                )}
                {item ? (
                  <span className="pill">
                    {item.inBasketAt ? 'In basket' : `On list · ${item.quantity ?? 1}`}
                  </span>
                ) : (
                  text.trim() && parsed.quantity && <span className="pill accent">{parsed.quantity}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </form>
  )
}
