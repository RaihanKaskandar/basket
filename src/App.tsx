import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { api, ApiError } from './api.ts'
import { buildTargets } from '../shared/match.ts'
import type {
  DataAction,
  Item,
  ItemPatch,
  Overview,
  Product,
  ProductInput,
  Settings,
  Suggestion,
} from '../shared/types.ts'
import { AddBar } from './components/AddBar.tsx'
import { CatalogView } from './components/CatalogView.tsx'
import type { CatalogEntry } from './components/CatalogView.tsx'
import { HistoryView } from './components/HistoryView.tsx'
import type { AddChoice } from './components/AddBar.tsx'
import { ClockIcon, GearIcon, GridIcon, ListIcon } from './components/bits.tsx'
import { ItemSheet } from './components/ItemSheet.tsx'
import { ListView } from './components/ListView.tsx'
import { ProductSheet } from './components/ProductSheet.tsx'
import { SettingsSheet } from './components/SettingsSheet.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { Suggestions } from './components/Suggestions.tsx'
import { applyLook, applyTheme, loadLook, loadTheme } from './theme.ts'
import type { Look, Theme } from './theme.ts'

type View = 'list' | 'products' | 'history'

const TABS: { value: View; label: string; Icon: () => ReactElement }[] = [
  { value: 'list', label: 'List', Icon: ListIcon },
  { value: 'products', label: 'Products', Icon: GridIcon },
  { value: 'history', label: 'History', Icon: ClockIcon },
]

interface Notice {
  text: string
  actions?: { label: string; run: () => void }[]
}

export default function App() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [settings, setSettings] = useState<Settings>({
    autoRemoveMinutes: 60,
    listOrder: 'section',
    showSuggestions: true,
  })
  const [view, setView] = useState<View>('list')
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [look, setLook] = useState<Look>(loadLook)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now)
  // Changes still on their way to the server. A reload that lands meanwhile would undo them on screen.
  const pending = useRef(0)
  const stale = useRef(false)

  const fail = useCallback((e: unknown) => setError(e instanceof Error ? e.message : String(e)), [])

  const refresh = useCallback(async () => {
    try {
      const [loadedItems, loadedProducts, loadedSuggestions, loadedSettings, loadedOverview] =
        await Promise.all([api.items(), api.products(), api.suggestions(), api.settings(), api.overview()])
      if (pending.current > 0) {
        stale.current = true
        return
      }
      setItems(loadedItems)
      setProducts(loadedProducts)
      setSuggestions(loadedSuggestions)
      setSettings(loadedSettings)
      setOverview(loadedOverview)
    } catch (e) {
      fail(e)
    }
  }, [fail])

  /** Runs a change against the server, keeping reloads from overwriting what is on screen meanwhile. */
  const send = useCallback(
    async <T,>(request: () => Promise<T>): Promise<T | undefined> => {
      pending.current++
      try {
        return await request()
      } finally {
        pending.current--
        if (pending.current === 0 && stale.current) {
          stale.current = false
          void refresh()
        }
      }
    },
    [refresh],
  )

  useEffect(() => {
    void refresh()
    // The server announces every change, so all phones stay in sync while shopping together.
    const source = new EventSource('/api/events')
    source.onmessage = () => void refresh()
    const onVisible = () => document.visibilityState === 'visible' && void refresh()
    document.addEventListener('visibilitychange', onVisible)
    const clock = setInterval(() => setNow(Date.now()), 15_000)
    return () => {
      source.close()
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(clock)
    }
  }, [refresh])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (flashId === null) return
    const timer = setTimeout(() => setFlashId(null), 1600)
    return () => clearTimeout(timer)
  }, [flashId])

  const targets = useMemo(() => buildTargets(products), [products])

  /** Adds straight away on screen, then swaps in what the server made of it. */
  /** Adds straight away on screen, then swaps in what the server made of it. */
  async function add({ input, name, quantity, category }: AddChoice) {
    // Already on the list: the server adds to that item, so there is no new row to show.
    const existing = input.productId ? items?.find((i) => i.productId === input.productId) : undefined
    const tempId = -Date.now()
    if (!existing) {
      const temp: Item = {
        id: tempId,
        productId: input.productId ?? tempId,
        name,
        quantity,
        category,
        addedAt: new Date().toISOString(),
        inBasketAt: null,
      }
      setItems((list) => [...(list ?? []), temp])
    }
    setSuggestions((list) => list.filter((s) => s.productId !== input.productId))
    try {
      const result = (await send(() => api.addItem(input)))!
      const { merged, ...item } = result
      setItems((list) => {
        const rest = (list ?? []).filter((i) => i.id !== tempId)
        return rest.some((i) => i.id === item.id)
          ? rest.map((i) => (i.id === item.id ? item : i))
          : [...rest, item]
      })
      if (merged) {
        setFlashId(item.id)
        setNotice({
          text: merged.inBasketAt
            ? `${item.name} is back on the list`
            : `${item.name}: ${item.quantity ?? 1} on the list`,
          actions: [
            {
              label: 'Undo',
              run: () => {
                setNotice(null)
                void patchItem(
                  item,
                  { quantity: merged.quantity, ...(merged.inBasketAt ? { inBasket: true } : {}) },
                  merged,
                )
              },
            },
            { label: 'Change', run: () => openFromNotice(item) },
          ],
        })
      }
      return item
    } catch (e) {
      setItems((list) => (list ?? []).filter((i) => i.id !== tempId))
      if (e instanceof ApiError && e.status === 409 && typeof e.data.itemId === 'number') {
        const itemId = e.data.itemId
        const current = items?.find((i) => i.id === itemId)
        setFlashId(itemId)
        setNotice({
          text: e.message,
          actions: current ? [{ label: 'Change amount', run: () => openFromNotice(current) }] : undefined,
        })
      } else {
        fail(e)
      }
      return undefined
    }
  }

  /** From the Products tab: a known product, or a catalog grocery that becomes one. */
  function addEntry(entry: CatalogEntry) {
    void add({
      input: entry.productId
        ? { text: entry.name, productId: entry.productId }
        : { text: entry.name, catalogKey: entry.catalogKey! },
      name: entry.name,
      quantity: null,
      category: entry.category,
    })
  }

  function openFromNotice(item: Item) {
    setNotice(null)
    setEditing(item)
  }

  function addProduct(product: { id: number; name: string; category: Product['category'] }) {
    void add({
      input: { text: product.name, productId: product.id },
      name: product.name,
      quantity: null,
      category: product.category,
    })
  }

  async function patchItem(item: Item, patch: ItemPatch, preview: Partial<Item>) {
    // Still being added; it can be changed once the server has it.
    if (item.id < 0) return
    setItems((list) => (list ?? []).map((i) => (i.id === item.id ? { ...i, ...preview } : i)))
    try {
      const updated = await send(() => api.updateItem(item.id, patch))
      setItems((list) => (list ?? []).map((i) => (i.id === item.id ? updated! : i)))
    } catch (e) {
      fail(e)
      void refresh()
    }
  }

  const toggle = (item: Item) =>
    patchItem(
      item,
      { inBasket: !item.inBasketAt },
      { inBasketAt: item.inBasketAt ? null : new Date().toISOString() },
    )

  async function remove(item: Item) {
    if (item.id < 0) return
    setItems((list) => (list ?? []).filter((i) => i.id !== item.id))
    try {
      await send(() => api.deleteItem(item.id))
      setNotice({
        text: `Removed ${item.name}`,
        actions: [
          {
            label: 'Undo',
            run: () => {
              setNotice(null)
              void (async () => {
                const back = await add({
                  input: { text: item.name, productId: item.productId },
                  name: item.name,
                  quantity: item.quantity,
                  category: item.category,
                })
                if (back && (item.quantity || item.inBasketAt)) {
                  await patchItem(
                    back,
                    { quantity: item.quantity, ...(item.inBasketAt ? { inBasket: true } : {}) },
                    { quantity: item.quantity, inBasketAt: item.inBasketAt },
                  )
                }
              })()
            },
          },
        ],
      })
    } catch (e) {
      fail(e)
      void refresh()
    }
  }

  async function clearBasket() {
    const count = items?.filter((i) => i.inBasketAt).length ?? 0
    setItems((list) => (list ?? []).filter((i) => !i.inBasketAt))
    try {
      await send(api.clearBasket)
      setNotice({
        text: count === 1 ? 'Cleared 1 item from the basket' : `Cleared ${count} items from the basket`,
      })
    } catch (e) {
      fail(e)
    }
    void refresh()
  }

  async function addMany(productIds: number[]) {
    try {
      const result = await send(() => api.addMany(productIds))
      await refresh()
      const added = result?.added ?? 0
      setNotice({ text: added === 1 ? 'Added 1 item' : `Added ${added} items` })
    } catch (e) {
      fail(e)
    }
  }

  async function dismiss(suggestion: Suggestion) {
    setSuggestions((list) => list.filter((s) => s.productId !== suggestion.productId))
    try {
      await send(() => api.snooze(suggestion.productId))
    } catch (e) {
      fail(e)
    }
  }

  async function changeProducts(change: () => Promise<unknown>) {
    try {
      await send(change)
      await refresh()
      return true
    } catch (e) {
      fail(e)
      return false
    }
  }

  async function changeSettings(next: Settings) {
    setSettings(next)
    try {
      setSettings((await send(() => api.saveSettings(next)))!)
    } catch (e) {
      fail(e)
    }
  }

  /** A clean-up from Settings: run it, reload everything, and say what happened. */
  async function dataAction(action: DataAction) {
    try {
      const result = await send(() => api.dataAction(action))
      await refresh()
      const removed = result?.removed ?? 0
      const messages: Record<DataAction, string> = {
        'clear-today': `Removed ${removed} of today's purchases`,
        'clear-history': `Cleared ${removed} purchases from the history`,
        'clear-list': `Cleared ${removed} items from the list`,
        'forget-unused': `Forgot ${removed} unused products`,
        reset: 'Everything was reset',
      }
      setNotice({ text: messages[action] })
      return true
    } catch (e) {
      fail(e)
      return false
    }
  }

  function changeTheme(next: Theme) {
    setTheme(next)
    applyTheme(next)
  }

  function changeLook(next: Look) {
    setLook(next)
    applyLook(next)
  }

  if (!items) {
    return <div className="splash">{error ?? 'Loading…'}</div>
  }

  const toGetCount = items.filter((i) => !i.inBasketAt).length

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="/icon-192.png" alt="" />
          Basket
        </div>

        <nav className="tabs" aria-label="Sections">
          {TABS.map(({ value, label, Icon }) => (
            <button
              key={value}
              className="tab"
              aria-current={view === value ? 'page' : undefined}
              onClick={() => setView(value)}
            >
              <Icon />
              {label}
              {value === 'list' && toGetCount > 0 && <span className="tab-count">{toGetCount}</span>}
            </button>
          ))}
        </nav>

        <button className="icon-btn" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          <GearIcon />
        </button>
      </header>

      {view === 'list' ? (
        <main className="list-layout">
          <div className="list-main">
            <AddBar targets={targets} items={items} onAdd={(choice) => void add(choice)} />
            <Suggestions
              suggestions={settings.showSuggestions ? suggestions : []}
              onAdd={(s) => addProduct({ id: s.productId, name: s.name, category: s.category })}
              onDismiss={(s) => void dismiss(s)}
            />
            <ListView
              items={items}
              now={now}
              autoRemoveMinutes={settings.autoRemoveMinutes}
              listOrder={settings.listOrder}
              flashId={flashId}
              onToggle={(item) => void toggle(item)}
              onOpen={setEditing}
              onRemove={(item) => void remove(item)}
              onClearBasket={() => void clearBasket()}
            />
          </div>
          <Sidebar
            items={items}
            products={products}
            suggestions={settings.showSuggestions ? suggestions : []}
            overview={overview}
            onAdd={addProduct}
            onDismiss={(s) => void dismiss(s)}
            onAddMany={(ids) => void addMany(ids)}
          />
        </main>
      ) : view === 'products' ? (
        <CatalogView products={products} items={items} onAdd={addEntry} onEdit={setEditingProduct} />
      ) : (
        <HistoryView
          products={products}
          items={items}
          overview={overview}
          onOpen={setEditingProduct}
          onAdd={addProduct}
          onAddMany={(ids) => void addMany(ids)}
        />
      )}

      {editing && (
        <ItemSheet
          item={editing}
          onSave={(patch) => void patchItem(editing, patch, patch)}
          onDelete={() => void remove(editing)}
          onClose={() => setEditing(null)}
        />
      )}

      {editingProduct && (
        <ProductSheet
          product={editingProduct}
          onSave={(input: ProductInput) => changeProducts(() => api.updateProduct(editingProduct.id, input))}
          onForget={() => changeProducts(() => api.deleteProduct(editingProduct.id))}
          onClose={() => setEditingProduct(null)}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          theme={theme}
          look={look}
          settings={settings}
          onTheme={changeTheme}
          onLook={changeLook}
          onSettings={(next) => void changeSettings(next)}
          onDataAction={dataAction}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {notice && !error && (
        <div className="toast" role="status">
          <span>{notice.text}</span>
          {notice.actions?.map((action) => (
            <button key={action.label} onClick={action.run}>
              {action.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
    </div>
  )
}
