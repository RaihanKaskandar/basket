import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CATALOG } from './catalog.ts'
import { buildTargets, guessCategory, matchKey, parseQuantity, recognise, search } from './match.ts'

const targets = buildTargets([])
const keyOf = (query: string) => recognise(targets, query)?.target.catalogKey ?? null
const topOf = (query: string) => search(targets, query, 1)[0]?.target.catalogKey ?? null

test('English and Dutch names are the same product', () => {
  assert.equal(keyOf('bread'), 'bread')
  assert.equal(keyOf('brood'), 'bread')
  assert.equal(keyOf('melk'), 'milk')
  assert.equal(keyOf('pindakaas'), 'peanut butter')
  assert.equal(keyOf('wc papier'), 'toilet paper')
})

test('plurals and diminutives', () => {
  assert.equal(keyOf('apples'), 'apple')
  assert.equal(keyOf('appels'), 'apple')
  assert.equal(keyOf('appeltjes'), 'apple')
  assert.equal(keyOf('tomaten'), 'tomato')
  assert.equal(keyOf('tomatoes'), 'tomato')
  assert.equal(keyOf('uien'), 'onion')
  assert.equal(keyOf('aardappelen'), 'potato')
  assert.equal(keyOf('strawberries'), 'strawberry')
  assert.equal(keyOf('eieren'), 'eggs')
  assert.equal(recognise(targets, 'melkk')?.label, 'Milk')
})

test('a distinct exact name beats a shared stem', () => {
  assert.equal(keyOf('broodjes'), 'bread rolls')
  assert.equal(keyOf('bloemen'), 'flowers')
  assert.equal(keyOf('bloem'), 'flour')
})

test('typos and prefixes', () => {
  assert.equal(topOf('melkk'), 'milk')
  assert.equal(topOf('aardapelen'), 'potato')
  assert.equal(topOf('bananna'), 'banana')
  assert.equal(topOf('komkomer'), 'cucumber')
  assert.equal(topOf('hagel'), 'chocolate sprinkles')
  assert.equal(keyOf('mel'), null)
})

test('Dutch is understood but everything is shown in English', () => {
  assert.equal(recognise(targets, 'brood')?.label, 'Bread')
  assert.equal(recognise(targets, 'appels')?.label, 'Apple')
  assert.equal(recognise(targets, 'apples')?.label, 'Apples')
  assert.equal(search(targets, 'pindak')[0].label, 'Peanut butter')
  const labels = search(targets, 'ap').map((m) => m.label)
  assert.ok(labels.includes('Apple') && labels.includes('Apple juice'))
  assert.ok(!labels.includes('Syrup') && !labels.some((l) => l.startsWith('Appel')))
  const own = buildTargets([
    { id: 1, name: 'Bread', category: 'bakery', catalogKey: 'bread', aliases: [], timesBought: 4 },
  ])
  const [match] = search(own, 'brood')
  assert.equal(match.target.productId, 1)
  assert.equal(match.label, 'Bread')
})

test('quantities', () => {
  assert.deepEqual(parseQuantity('2 melk'), { name: 'melk', quantity: '2' })
  assert.deepEqual(parseQuantity('milk x2'), { name: 'milk', quantity: '2' })
  assert.deepEqual(parseQuantity('500g gehakt'), { name: 'gehakt', quantity: '500 g' })
  assert.deepEqual(parseQuantity('3 pak yoghurt'), { name: 'yoghurt', quantity: '3 pak' })
  assert.deepEqual(parseQuantity('0.0 bier'), { name: '0.0 bier', quantity: null })
  assert.deepEqual(parseQuantity('kaas'), { name: 'kaas', quantity: null })
})

test('categories for unknown products', () => {
  assert.equal(guessCategory('biologische melk'), 'dairy')
  assert.equal(guessCategory('kokosyoghurt'), 'dairy')
  assert.equal(guessCategory('xyz'), 'other')
})

test('catalog names do not collide', () => {
  const seen = new Map<string, string>()
  for (const entry of CATALOG) {
    for (const name of [...entry.en, ...entry.nl]) {
      const flat = name.toLowerCase().replace(/[^a-z0-9]/g, '')
      const owner = seen.get(flat)
      assert.ok(!owner || owner === entry.key, `"${name}" is used by ${owner} and ${entry.key}`)
      seen.set(flat, entry.key)
    }
  }
  assert.equal(matchKey('volkoren brood'), matchKey('volkorenbrood'))
})
