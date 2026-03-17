import { describe, it, expect } from 'vitest'
import { createPool, Pool, PoolNode } from '../pool'

type Item = { value: string | null } & PoolNode<Item>
type ItemArgs = [value: string]

function allocate(this: Pool<Item, ItemArgs>, value: string) {
  const item = this.next()
  item.value = value
  return item
}

const create = (): Item => ({ value: null })

describe('memory pool', () => {
  it('it can create a new pool of items of the correct size', () => {
    const pool = createPool(5, create, allocate)
    expect(pool.data.length).toBe(5)
  })

  it('it explicitly grow new pool of items of the correct size', () => {
    const pool = createPool(5, create, allocate).grow(10)
    expect(pool.data.length).toBe(15)
  })

  it('can allocate items and auto grow', () => {
    const pool = createPool(3, create, allocate)
    const item = pool.allocate('a')
    expect(item).toMatchObject({ value: 'a' })
    expect(item.next).toBeUndefined()
    expect(pool.data[0]).toEqual({ value: 'a' })
    expect(pool.data.indexOf(item)).toBe(0)
    pool.allocate('b')
    pool.allocate('c')
    expect(pool.data.map((item) => item.value)).toEqual(['a', 'b', 'c'])
    pool.allocate('d')
    expect(pool.data.length).toBe(6)
  })

  it('can free items and re-allocate', () => {
    const pool = createPool(3, create, allocate)
    pool.allocate('a')
    const middle = pool.allocate('b')
    pool.allocate('c')
    pool.free(middle)
    pool.allocate('d')
    expect(pool.data.map((item) => item.value)).toEqual(['a', 'd', 'c'])
    pool.allocate('e')
    expect(pool.data.map((item) => item.value)).toEqual([
      'a',
      'd',
      'c',
      'e',
      null,
      null,
    ])
    pool.allocate('f')
    expect(pool.data.map((item) => item.value)).toEqual([
      'a',
      'd',
      'c',
      'e',
      'f',
      null,
    ])
  })

  it('grows in slab order and never returns the same node twice without a free', () => {
    const pool = createPool(2, create, allocate)
    const first = pool.allocate('a')
    const second = pool.allocate('b')
    const third = pool.allocate('c')

    expect(new Set([first, second, third]).size).toBe(3)
    expect(pool.data.indexOf(first)).toBe(0)
    expect(pool.data.indexOf(second)).toBe(1)
    expect(pool.data.indexOf(third)).toBe(2)
    expect(pool.data.indexOf(pool.head!)).toBe(3)
  })
})
