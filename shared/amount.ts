// Adds up quantities on the list: "2" + "3" is "5", "500 g" + "250 g" is "750 g", and an item
// without a quantity counts as one. Different units ("1 pak" + "500 g") can't be added up.

const UNITS: Record<string, string> = {
  x: '',
  '×': '',
  st: '',
  stuk: '',
  stuks: '',
  pcs: '',
  piece: '',
  pieces: '',
  g: 'g',
  gr: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilo: 'kg',
  l: 'l',
  liter: 'l',
  litre: 'l',
  liters: 'l',
  ml: 'ml',
  cl: 'cl',
}

interface Amount {
  value: number
  unit: string
}

/** Reads "2", "1,5 kg" or "500 g"; no quantity means one. Anything else is not a number. */
function read(quantity: string | null): Amount | null {
  if (quantity === null || !quantity.trim()) return { value: 1, unit: '' }
  const match = /^(\d+(?:[.,]\d+)?|½|¼)\s*([^\d\s].*)?$/.exec(quantity.trim())
  if (!match) return null
  const value = match[1] === '½' ? 0.5 : match[1] === '¼' ? 0.25 : Number(match[1].replace(',', '.'))
  const unit = (match[2] ?? '').trim().toLowerCase()
  return { value, unit: UNITS[unit] ?? unit }
}

function write({ value, unit }: Amount): string | null {
  const rounded = Math.round(value * 100) / 100
  if (!unit && rounded === 1) return null
  return unit ? `${rounded} ${unit}` : String(rounded)
}

/** The two quantities added up, or undefined when they can't be (different units). */
export function addAmounts(current: string | null, extra: string | null): string | null | undefined {
  const a = read(current)
  const b = read(extra)
  if (!a || !b || a.unit !== b.unit) return undefined
  return write({ value: a.value + b.value, unit: a.unit })
}

/** Weights and volumes: one more gram is not a useful step. */
const MEASURES = new Set(['g', 'kg', 'l', 'ml', 'cl'])

/** One more or one less, never below one; undefined unless the quantity is a count ("2", "3 pak"). */
export function stepAmount(current: string | null, by: 1 | -1): string | null | undefined {
  const a = read(current)
  if (!a || MEASURES.has(a.unit)) return undefined
  return write({ value: Math.max(1, a.value + by), unit: a.unit })
}
