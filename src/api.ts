import type {
  AddItemInput,
  AddResult,
  Item,
  ItemPatch,
  DataAction,
  DataCounts,
  Overview,
  Product,
  ProductInput,
  Settings,
  Suggestion,
} from '../shared/types.ts'

/** A failed request, with whatever else the server sent along (such as the duplicate's id). */
export class ApiError extends Error {
  status: number
  data: Record<string, unknown>
  constructor(status: number, message: string, data: Record<string, unknown>) {
    super(message)
    this.status = status
    this.data = data
  }
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new ApiError(response.status, detail?.error ?? `Request failed (${response.status})`, detail ?? {})
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export const api = {
  items: () => request<Item[]>('/items'),
  addItem: (input: AddItemInput) => request<AddResult>('/items', 'POST', input),
  updateItem: (id: number, patch: ItemPatch) => request<Item>(`/items/${id}`, 'PATCH', patch),
  deleteItem: (id: number) => request<Item>(`/items/${id}`, 'DELETE'),
  addMany: (productIds: number[]) => request<{ added: number }>('/items/many', 'POST', { productIds }),
  clearBasket: () => request<void>('/basket/clear', 'POST'),
  products: () => request<Product[]>('/products'),
  updateProduct: (id: number, input: ProductInput) => request<Product>(`/products/${id}`, 'PUT', input),
  deleteProduct: (id: number) => request<void>(`/products/${id}`, 'DELETE'),
  overview: () => request<Overview>('/overview'),
  suggestions: () => request<Suggestion[]>('/suggestions'),
  snooze: (productId: number) => request<void>(`/suggestions/${productId}/snooze`, 'POST'),
  dataCounts: () => request<DataCounts>('/data'),
  dataAction: (action: DataAction) => request<{ removed: number }>(`/data/${action}`, 'POST'),
  settings: () => request<Settings>('/settings'),
  saveSettings: (settings: Settings) => request<Settings>('/settings', 'PUT', settings),
}
