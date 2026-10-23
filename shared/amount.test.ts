import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addAmounts, stepAmount } from './amount.ts'

test('adding the same product again adds up the amounts', () => {
  assert.equal(addAmounts(null, null), '2')
  assert.equal(addAmounts('2', null), '3')
  assert.equal(addAmounts('2', '3'), '5')
  assert.equal(addAmounts('500 g', '250 gram'), '750 g')
  assert.equal(addAmounts('1,5 kg', '1 kilo'), '2.5 kg')
  assert.equal(addAmounts('1 pak', '2 pak'), '3 pak')
})

test('different units are not added up', () => {
  assert.equal(addAmounts('1 pak', '500 g'), undefined)
  assert.equal(addAmounts('a bunch', null), undefined)
  assert.equal(addAmounts('500 g', null), undefined)
})

test('stepping up and down', () => {
  assert.equal(stepAmount(null, 1), '2')
  assert.equal(stepAmount('2', -1), null)
  assert.equal(stepAmount(null, -1), null)
  assert.equal(stepAmount('2 pak', 1), '3 pak')
  assert.equal(stepAmount('500 g', 1), undefined)
  assert.equal(stepAmount('a bunch', 1), undefined)
})
