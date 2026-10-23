export class HttpError extends Error {
  status: number
  /** Extra fields sent along with the error message. */
  data: Record<string, unknown>
  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.data = data
  }
}

export function parseId(value: unknown): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid id')
  return id
}
