import type { Request, Response } from 'express'

// Every open app keeps a Server-Sent Events stream, so a change on one phone shows up on the others.
const clients = new Set<Response>()
let version = 0

/** Tells every open app that the list or products changed, so they reload. */
export function changed() {
  version++
  for (const res of clients) res.write(`data: ${version}\n\n`)
}

export function events(req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Stops Nginx (and Nginx Proxy Manager) from holding the stream back.
    'X-Accel-Buffering': 'no',
  })
  res.write(`retry: 3000\ndata: ${version}\n\n`)
  clients.add(res)
  req.on('close', () => clients.delete(res))
}

// A comment now and then keeps proxies from closing a quiet stream.
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n')
}, 25_000).unref()
