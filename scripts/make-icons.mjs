// Draws the app icon (a green shopping basket with an apple and leaves peeking out) into public/
// as PNGs, because iOS needs a PNG for the home-screen icon. Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}
const png = (size, pixel) => {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      raw.set(pixel(x, y), y * (size * 4 + 1) + 1 + x * 4)
    }
  }
  const head = Buffer.alloc(13)
  head.writeUInt32BE(size, 0)
  head.writeUInt32BE(size, 4)
  head.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const lerp = (a, b, t) => a + (b - a) * t
const roundRect = (x, y, cx, cy, hw, hh, r) => {
  const qx = Math.abs(x - cx) - (hw - r),
    qy = Math.abs(y - cy) - (hh - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) <= r
}

/**
 * A pointed leaf (two overlapping circles) growing from a base point, tilted from upright towards
 * the right: 0 outside, 1 on the leaf, 2 on its centre vein.
 */
const leaf = (x, y, baseX, baseY, length, width, tilt) => {
  const dirX = Math.sin(tilt),
    dirY = -Math.cos(tilt)
  const dx = x - (baseX + length * dirX),
    dy = y - (baseY + length * dirY)
  const along = dx * dirX + dy * dirY
  const across = dx * -dirY + dy * dirX
  const r = (length ** 2 + width ** 2) / (2 * width)
  const inside = Math.hypot(along, across - (r - width)) <= r && Math.hypot(along, across + (r - width)) <= r
  if (!inside) return 0
  return Math.abs(across) < 0.006 && along < length * 0.75 ? 2 : 1
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const LEAF = hex('#5ccb88')
const LEAF_DARK = hex('#2f9e5e')
const VEIN = hex('#1f7f47')
const APPLE = hex('#a6e6bd')
const APPLE_SHINE = hex('#d8f5e2')
const DARK = hex('#17803f')
const BODY_TOP = hex('#39c172')
const BODY_BOTTOM = hex('#1b7d42')

/** The colour at a point in 0..1 icon space, or null where it is see-through. Painted back to front. */
const paint = (x, y) => {
  // Body: narrows towards the bottom, rounded at the base, with slats cut out.
  const t = (y - 0.575) / 0.265
  if (t >= 0 && t <= 1) {
    const half = lerp(0.335, 0.255, t)
    const dx = Math.abs(x - 0.5)
    const r = 0.045
    const inside =
      dx <= half && !(t > 1 - r / 0.265 && dx > half - r && Math.hypot(dx - (half - r), y - (0.84 - r)) > r)
    if (inside) {
      const slat = t > 0.2 && t < 0.8 && [-0.5, 0, 0.5].some((k) => Math.abs(x - 0.5 - k * half) < 0.021)
      return slat ? null : BODY_TOP.map((c, i) => lerp(c, BODY_BOTTOM[i], t))
    }
  }
  // Rim.
  if (roundRect(x, y, 0.5, 0.53, 0.37, 0.05, 0.035)) return DARK
  // Handle: the top half of a ring.
  const ring = Math.hypot(x - 0.5, y - 0.5)
  if (y <= 0.5 && ring >= 0.25 && ring <= 0.292) return DARK
  // Groceries peeking out above the rim.
  if (y < 0.53) {
    if (Math.hypot(x - 0.355, y - 0.395) < 0.03) return APPLE_SHINE
    if (Math.hypot(x - 0.39, y - 0.44) < 0.115) return APPLE
    const front = leaf(x, y, 0.585, 0.5, 0.115, 0.045, 1.0)
    if (front) return front === 2 ? VEIN : LEAF
    const back = leaf(x, y, 0.585, 0.5, 0.145, 0.052, 0.3)
    if (back) return back === 2 ? VEIN : LEAF_DARK
  }
  return null
}

/** `scale` shrinks the mark; `background` fills what would otherwise be see-through. */
const draw = (size, { scale = 1, background = null } = {}) =>
  png(size, (x, y) => {
    const n = 4
    let alpha = 0
    const sum = [0, 0, 0]
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const u = (x + (i + 0.5) / n) / size
        const v = (y + (j + 0.5) / n) / size
        const colour = paint(0.5 + (u - 0.5) / scale, 0.5 + (v - 0.5) / scale) ?? background
        if (!colour) continue
        alpha++
        colour.forEach((c, k) => (sum[k] += c))
      }
    if (alpha === 0) return [0, 0, 0, 0]
    return [...sum.map((c) => Math.round(c / alpha)), Math.round((255 * alpha) / (n * n))]
  })

const WHITE = [255, 255, 255]

mkdirSync('public', { recursive: true })
// iOS fills transparent home-screen icons with black, so this one gets a white background.
writeFileSync('public/apple-touch-icon.png', draw(180, { scale: 0.9, background: WHITE }))
writeFileSync('public/icon-192.png', draw(192))
writeFileSync('public/icon-512.png', draw(512))
// Android crops maskable icons to a shape of its own, so it needs a full background and a safe zone.
writeFileSync('public/icon-maskable-512.png', draw(512, { scale: 0.68, background: WHITE }))
