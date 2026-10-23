import { useEffect, useState } from 'react'
import { CATALOG } from '../../shared/catalog.ts'
import { duration } from '../../shared/format.ts'
import type { DataAction, DataCounts, Settings } from '../../shared/types.ts'
import { api } from '../api.ts'
import type { Look, Theme } from '../theme.ts'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const ORDERS: { value: Settings['listOrder']; label: string }[] = [
  { value: 'section', label: 'By section' },
  { value: 'added', label: 'As added' },
]

const PRESETS = [5, 30, 60, 240, 1440]

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The clean-ups, with what they would remove right now and what to ask before doing it. */
const CLEANUPS: {
  action: DataAction
  title: string
  detail: (c: DataCounts) => string
  amount: (c: DataCounts) => number
  confirm: string
  danger?: boolean
}[] = [
  {
    action: 'clear-today',
    title: "Remove today's purchases",
    detail: (c) => `${plural(c.purchasesToday, 'thing')} bought today, from history and stats.`,
    amount: (c) => c.purchasesToday,
    confirm: "Remove today's purchases from the history? The list itself doesn't change.",
  },
  {
    action: 'clear-list',
    title: 'Clear the list',
    detail: (c) =>
      `${plural(c.items, 'item')} on the list and in the basket, without counting them as bought.`,
    amount: (c) => c.items,
    confirm: 'Remove everything from the list and the basket?',
  },
  {
    action: 'forget-unused',
    title: 'Forget unused products',
    detail: (c) => `${plural(c.unusedProducts, 'product')} you added once but never bought.`,
    amount: (c) => c.unusedProducts,
    confirm: 'Forget products that were never bought and are not on the list?',
  },
  {
    action: 'clear-history',
    title: 'Clear all history',
    detail: (c) => `${plural(c.purchases, 'purchase')}. Suggestions and stats start over.`,
    amount: (c) => c.purchases,
    confirm: 'Delete the whole purchase history? Suggestions and stats start over. This cannot be undone.',
    danger: true,
  },
  {
    action: 'reset',
    title: 'Reset everything',
    detail: (c) => `The list, history and ${plural(c.products, 'product')}. Settings are kept.`,
    amount: (c) => c.products,
    confirm: 'Delete the list, the history and every product, and start fresh? This cannot be undone.',
    danger: true,
  },
]

interface Props {
  theme: Theme
  look: Look
  settings: Settings
  onTheme: (theme: Theme) => void
  onLook: (look: Look) => void
  onSettings: (settings: Settings) => void
  onDataAction: (action: DataAction) => Promise<boolean>
  onClose: () => void
}

export function SettingsSheet({
  theme,
  look,
  settings,
  onTheme,
  onLook,
  onSettings,
  onDataAction,
  onClose,
}: Props) {
  const minutes = settings.autoRemoveMinutes
  const custom = minutes !== null && !PRESETS.includes(minutes)
  const [own, setOwn] = useState(custom ? String(minutes) : '')
  const [counts, setCounts] = useState<DataCounts | null>(null)
  const [busy, setBusy] = useState<DataAction | null>(null)

  useEffect(() => {
    api
      .dataCounts()
      .then(setCounts)
      .catch(() => setCounts(null))
  }, [])

  const change = (patch: Partial<Settings>) => onSettings({ ...settings, ...patch })

  function saveOwn() {
    const value = Math.round(Number(own))
    if (Number.isFinite(value) && value >= 1 && value <= 10080) change({ autoRemoveMinutes: value })
    else setOwn(custom ? String(minutes) : '')
  }

  async function cleanUp(cleanup: (typeof CLEANUPS)[number]) {
    if (!window.confirm(cleanup.confirm)) return
    setBusy(cleanup.action)
    await onDataAction(cleanup.action)
    setCounts(await api.dataCounts().catch(() => null))
    setBusy(null)
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <h2 id="settings-title">Settings</h2>

        <section className="settings-section">
          <h3 className="eyebrow">Appearance</h3>
          <div className="field">
            <div className="segmented" role="group" aria-label="Theme">
              {THEMES.map(({ value, label }) => (
                <button key={value} aria-pressed={theme === value} onClick={() => onTheme(value)}>
                  {label}
                </button>
              ))}
            </div>
            <span className="hint">Auto follows your device's light or dark setting.</span>
          </div>

          <div className="switch-row">
            <div>
              <span className="field-label">
                Glass style <span className="badge">Experimental</span>
              </span>
              <span className="hint">Frosted, translucent panels. May look rough in places.</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={look === 'glass'}
              aria-label="Glass style"
              onClick={() => onLook(look === 'glass' ? 'classic' : 'glass')}
            />
          </div>
        </section>

        <section className="settings-section">
          <h3 className="eyebrow">Shopping</h3>

          <div className="field">
            <span className="field-label">Sort the list</span>
            <div className="segmented" role="group" aria-label="Sort the list">
              {ORDERS.map(({ value, label }) => (
                <button
                  key={value}
                  aria-pressed={settings.listOrder === value}
                  onClick={() => change({ listOrder: value })}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="hint">
              {settings.listOrder === 'section'
                ? 'Grouped by store section, in the order you walk past them.'
                : 'One list, oldest first, in the order things were added.'}
            </span>
          </div>

          <div className="switch-row">
            <div>
              <span className="field-label">Suggestions</span>
              <span className="hint">Things you probably need, based on what you usually buy.</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={settings.showSuggestions}
              aria-label="Suggestions"
              onClick={() => change({ showSuggestions: !settings.showSuggestions })}
            />
          </div>

          <div className="field">
            <span className="field-label">Remove from the basket after</span>
            <div className="presets">
              {PRESETS.map((value) => (
                <button
                  key={value}
                  className="preset"
                  aria-pressed={minutes === value}
                  onClick={() => {
                    setOwn('')
                    change({ autoRemoveMinutes: value })
                  }}
                >
                  {duration(value)}
                </button>
              ))}
              <button
                className="preset"
                aria-pressed={minutes === null}
                onClick={() => {
                  setOwn('')
                  change({ autoRemoveMinutes: null })
                }}
              >
                Never
              </button>
            </div>
            <div className="own-minutes">
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                max={10080}
                value={own}
                placeholder="Or your own"
                aria-label="Minutes before items leave the basket"
                onChange={(e) => setOwn(e.target.value)}
                onBlur={saveOwn}
                onKeyDown={(e) => e.key === 'Enter' && saveOwn()}
              />
              <span className="muted">minutes</span>
            </div>
            <span className="hint">
              Things you put in the basket stay visible for this long, then leave the list and count as
              bought.
              {minutes === null && ' With Never, use Clear basket when you are done shopping.'}
            </span>
          </div>
        </section>

        <section className="settings-section">
          <h3 className="eyebrow">Your data</h3>
          <ul className="data-list">
            <li className="data-row">
              <div>
                <span className="field-label">Download a backup</span>
                <span className="hint">The list, products and history as a JSON file.</span>
              </div>
              <a className="btn small" href="/api/export" download>
                Download
              </a>
            </li>
            {CLEANUPS.map((cleanup) => {
              const amount = counts ? cleanup.amount(counts) : 0
              return (
                <li key={cleanup.action} className="data-row">
                  <div>
                    <span className="field-label">{cleanup.title}</span>
                    <span className="hint">{counts ? cleanup.detail(counts) : '…'}</span>
                  </div>
                  <button
                    className={`btn small${cleanup.danger ? ' danger-outline' : ''}`}
                    disabled={!counts || amount === 0 || busy !== null}
                    onClick={() => void cleanUp(cleanup)}
                  >
                    {busy === cleanup.action ? 'Working…' : cleanup.danger ? 'Delete' : 'Remove'}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <p className="hint">
          Basket knows {CATALOG.length} common groceries, also by their Dutch names, and learns every new
          thing you add.
        </p>

        <div className="sheet-actions">
          <span className="spacer" />
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
