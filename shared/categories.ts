/** Store sections, in the order you usually walk past them. */
export const CATEGORIES = [
  { id: 'produce', label: 'Fruit & veg', icon: '🥦' },
  { id: 'bakery', label: 'Bakery', icon: '🥖' },
  { id: 'dairy', label: 'Dairy & eggs', icon: '🧀' },
  { id: 'meat', label: 'Meat, fish & veggie', icon: '🥩' },
  { id: 'breakfast', label: 'Breakfast & spreads', icon: '🥣' },
  { id: 'pantry', label: 'Pantry', icon: '🥫' },
  { id: 'frozen', label: 'Frozen', icon: '🧊' },
  { id: 'snacks', label: 'Snacks & sweets', icon: '🍫' },
  { id: 'drinks', label: 'Drinks', icon: '🥤' },
  { id: 'household', label: 'Household', icon: '🧻' },
  { id: 'care', label: 'Personal care', icon: '🧴' },
  { id: 'other', label: 'Other', icon: '🛒' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

const byId = new Map<string, (typeof CATEGORIES)[number]>(CATEGORIES.map((c) => [c.id, c]))

export const isCategory = (value: unknown): value is CategoryId =>
  typeof value === 'string' && byId.has(value)

export const categoryOf = (id: string) => byId.get(id) ?? byId.get('other')!

export const categoryOrder = (id: string) => CATEGORIES.findIndex((c) => c.id === id)
