import { DatabaseSync } from 'node:sqlite'
import type { SQLInputValue } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const path = resolve(process.env.DB_PATH ?? 'data/basket.db')
mkdirSync(dirname(path), { recursive: true })

export const db = new DatabaseSync(path)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  -- Everything the household has ever put on the list.
  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    -- The built-in grocery this is, which brings its English and Dutch names along.
    catalog_key TEXT UNIQUE,
    created_at  TEXT NOT NULL
  );

  -- Extra names a product is recognised by, normalised.
  CREATE TABLE IF NOT EXISTS aliases (
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    alias      TEXT NOT NULL,
    PRIMARY KEY (product_id, alias)
  );

  CREATE TABLE IF NOT EXISTS items (
    id           INTEGER PRIMARY KEY,
    product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    quantity     TEXT,
    added_at     TEXT NOT NULL,
    in_basket_at TEXT
  );

  -- Written when an item leaves the list after being in the basket; feeds the suggestions.
  CREATE TABLE IF NOT EXISTS purchases (
    id         INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity   TEXT,
    bought_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_purchases_product ON purchases(product_id, bought_at);

  -- Suggestions someone dismissed; they stay hidden until this moment or the next purchase.
  CREATE TABLE IF NOT EXISTS snoozes (
    product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    until      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

export const all = <T>(sql: string, ...params: SQLInputValue[]) =>
  db.prepare(sql).all(...params) as unknown as T[]

export const get = <T>(sql: string, ...params: SQLInputValue[]) =>
  db.prepare(sql).get(...params) as unknown as T | undefined

export const run = (sql: string, ...params: SQLInputValue[]) => db.prepare(sql).run(...params)

export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export const getMeta = (key: string) =>
  get<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)?.value

export const setMeta = (key: string, value: string) =>
  run(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    value,
  )

export const nowISO = () => new Date().toISOString()
