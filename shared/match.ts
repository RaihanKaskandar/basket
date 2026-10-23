// Understands what people type: "brood" and "bread" are the same product, "appeltjes" are apples,
// "melkk" is a typo for milk, and "2 pak melk" means milk with a quantity. Used for autocomplete in
// the browser and to recognise products on the server, so both always agree.
import { CATALOG, catalogEntry } from './catalog.ts'
import type { CategoryId } from './categories.ts'

/** Lowercase, no accents or apostrophes, punctuation as spaces. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Strips English and Dutch plurals and Dutch diminutives, so all forms share one stem. */
function stemWord(word: string): string {
  let w = word
  if (w.length <= 3) return w
  for (const suffix of ['tjes', 'tje', 'jes', 'je']) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
      w = w.slice(0, -suffix.length)
      break
    }
  }
  if (w.endsWith('ies') && w.length > 4) w = `${w.slice(0, -3)}y`
  else if (/(s|x|z|ch|sh|o)es$/.test(w) && w.length > 4) w = w.slice(0, -2)
  else if (w.endsWith('en') && w.length > 3) w = w.slice(0, -2)
  else if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) w = w.slice(0, -1)
  return w
}

/**
 * A spelling-tolerant key: the last word stemmed, spaces dropped, doubled letters collapsed.
 * So "tomaten" and "tomaat", "kippen" and "kip", "volkoren brood" and "volkorenbrood" all agree.
 */
export function matchKey(text: string): string {
  const words = normalize(text).split(' ').filter(Boolean)
  if (words.length === 0) return ''
  words[words.length - 1] = stemWord(words[words.length - 1])
  return words.join('').replace(/(.)\1+/g, '$1')
}

/** Optimal string alignment distance: edits, counting a swap of two letters as one. */
export function distance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev2: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, prev2[j - 2] + 1)
      }
      row.push(value)
      best = Math.min(best, value)
    }
    if (best > max) return max + 1
    prev2 = prev
    prev = row
  }
  return prev[b.length]
}

const UNITS =
  'x|×|kg|kilo|g|gr|gram|grams|l|liter|litre|liters|ml|cl|st|stuk|stuks|pcs|piece|pieces|pak|pakken|pack|packs|' +
  'zak|zakken|zakje|bag|bags|blik|blikken|can|cans|fles|flessen|bottle|bottles|bos|bossen|bunch|doos|dozen|' +
  'box|boxes|bakje|bakjes|tray|potje|pot|jar|jars|rol|rollen|roll|rolls'
const NUMBER = String.raw`\d+(?:[.,]\d+)?|½|¼`
const LEADING = new RegExp(String.raw`^(${NUMBER})\s*(${UNITS})?\.?\s+(.+)$`, 'i')
const TRAILING = new RegExp(String.raw`^(.+?)\s+(?:x\s*)?(${NUMBER})\s*(${UNITS})?$`, 'i')

/** Splits "2 melk", "milk x2" or "500g gehakt" into a quantity and the product name. */
export function parseQuantity(text: string): { name: string; quantity: string | null } {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  const leading = LEADING.exec(trimmed)
  const trailing = leading ? null : TRAILING.exec(trimmed)
  const [amount, unit, name] = leading
    ? [leading[1], leading[2], leading[3]]
    : trailing
      ? [trailing[2], trailing[3], trailing[1]]
      : []
  if (!amount || !name || Number(amount.replace(',', '.')) === 0) return { name: trimmed, quantity: null }
  const lowerUnit = unit?.toLowerCase()
  const quantity = !lowerUnit || lowerUnit === 'x' || lowerUnit === '×' ? amount : `${amount} ${lowerUnit}`
  return { name: name.trim(), quantity }
}

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export type Lang = 'en' | 'nl' | 'own'

export interface Term {
  text: string
  lang: Lang
  norm: string
  flat: string
  key: string
}

/** Something autocomplete can offer: a product the household knows, or a catalog entry. */
export interface Target {
  productId: number | null
  catalogKey: string | null
  name: string
  category: CategoryId
  terms: Term[]
  /** How often it was bought; frequent products rank higher. */
  timesBought: number
}

export interface ProductLike {
  id: number
  name: string
  category: CategoryId
  catalogKey: string | null
  aliases: string[]
  timesBought: number
}

function term(text: string, lang: Lang): Term {
  const norm = normalize(text)
  return { text, lang, norm, flat: norm.replace(/ /g, ''), key: matchKey(text) }
}

function terms(list: [string, Lang][]): Term[] {
  const seen = new Set<string>()
  const out: Term[] = []
  for (const [text, lang] of list) {
    const t = term(text, lang)
    if (!t.flat || seen.has(t.flat)) continue
    seen.add(t.flat)
    out.push(t)
  }
  return out
}

function catalogTerms(key: string | null): [string, Lang][] {
  const entry = catalogEntry(key)
  if (!entry) return []
  return [
    ...entry.en.map((n): [string, Lang] => [n, 'en']),
    ...entry.nl.map((n): [string, Lang] => [n, 'nl']),
  ]
}

/** Everything autocomplete can suggest: the household's products plus the rest of the catalog. */
export function buildTargets(products: ProductLike[]): Target[] {
  const linked = new Set(products.map((p) => p.catalogKey).filter(Boolean))
  const own: Target[] = products.map((p) => ({
    productId: p.id,
    catalogKey: p.catalogKey,
    name: p.name,
    category: p.category,
    timesBought: p.timesBought,
    terms: terms([
      [p.name, 'own'],
      ...p.aliases.map((a): [string, Lang] => [a, 'own']),
      ...catalogTerms(p.catalogKey),
    ]),
  }))
  const rest: Target[] = CATALOG.filter((entry) => !linked.has(entry.key)).map((entry) => ({
    productId: null,
    catalogKey: entry.key,
    name: capitalize(entry.en[0]),
    category: entry.category,
    timesBought: 0,
    terms: terms(catalogTerms(entry.key)),
  }))
  return [...own, ...rest]
}

export interface Match {
  target: Target
  /** The name to show and to put on the list: the spelling that matched what was typed. */
  label: string
  score: number
}

/** Exact spelling. Anything at or above STRONG is safe to pick without asking. */
export const EXACT = 120
export const STRONG = 100
/** Starts the same way, such as "bre" for bread: the likely pick, but not certain. */
export const LIKELY = 80

function scoreTerm(t: Term, qn: string, qf: string, qk: string): number {
  if (t.flat === qf) return EXACT
  // Short words only count when spelled exactly, so "mel" is not taken for "meel" (flour).
  if (qf.length >= 4 && t.key === qk) return STRONG
  // Dutch names are understood but never offered, so half a Dutch word needs a few letters
  // before it counts, and it is then shown under the English name.
  if (t.lang === 'nl') {
    if (qf.length >= 4 && t.flat.startsWith(qf)) return LIKELY
  } else if (t.flat.startsWith(qf)) return LIKELY + (10 * qf.length) / t.flat.length
  else if (qn.length >= 2 && t.norm.split(' ').some((word) => word.startsWith(qn))) return 70
  else if (qf.length >= 4 && t.flat.includes(qf)) return 55
  if (qk.length >= 4) {
    const allowed = qk.length >= 7 ? 2 : 1
    const d = distance(qk, t.key, allowed)
    if (d <= allowed) return 65 - 10 * d
    if (t.key.length > qk.length && distance(qk, t.key.slice(0, qk.length), 1) <= 1) return 40
  }
  return 0
}

/** Ranks targets for what has been typed so far. */
export function search(targets: Target[], query: string, limit = 8): Match[] {
  const qn = normalize(query)
  if (!qn) return []
  const qf = qn.replace(/ /g, '')
  const qk = matchKey(query)
  const matches: Match[] = []
  for (const target of targets) {
    let best = 0
    let bestTerm: Term | null = null
    for (const t of target.terms) {
      const score = scoreTerm(t, qn, qf, qk)
      if (score > best) {
        best = score
        bestTerm = t
      }
    }
    if (!bestTerm) continue
    const boost = Math.min(12, 4 * Math.log2(1 + target.timesBought))
    // A different form of the same word ("appels" for appel) keeps the form that was typed,
    // but a doubled letter ("melkk") is just a slip and gets the proper spelling.
    const single = (text: string) => text.replace(/(.)\1+/g, '$1')
    const slip = single(qf) === single(bestTerm.flat)
    // A Dutch word is shown as the English product ("brood" adds Bread).
    const label =
      bestTerm.lang === 'nl'
        ? target.name
        : best === STRONG && !slip
          ? capitalize(query.trim())
          : bestTerm.lang === 'own'
            ? bestTerm.text
            : capitalize(bestTerm.text)
    matches.push({ target, label, score: best + boost })
  }
  return matches.sort((a, b) => b.score - a.score || a.label.length - b.label.length).slice(0, limit)
}

/** The best match when it is certain enough to use without asking, such as "brood" for bread. */
export function recognise(targets: Target[], query: string): Match | null {
  const [best] = search(targets, query, 1)
  return best && best.score >= STRONG ? best : null
}

const CATALOG_TERMS = CATALOG.flatMap((entry) =>
  [...entry.en, ...entry.nl].map((name) => ({ key: matchKey(name), category: entry.category })),
).filter((t) => t.key.length >= 3)

/** A section for something not in the catalog: "biologische melk" ends in milk, so it is dairy. */
export function guessCategory(text: string): CategoryId {
  const key = matchKey(text)
  // The last part names the thing ("kokosyoghurt" is a yoghurt), so endings win over beginnings.
  const longest = (fits: (t: (typeof CATALOG_TERMS)[number]) => boolean) =>
    CATALOG_TERMS.filter(fits).sort((a, b) => b.key.length - a.key.length)[0]
  const best = longest((t) => key.endsWith(t.key)) ?? longest((t) => key.startsWith(t.key))
  return best?.category ?? 'other'
}
