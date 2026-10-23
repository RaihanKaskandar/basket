/** "every day", "every 6 days", "every 2 weeks" */
export function every(days: number): string {
  if (days < 1.5) return 'every day'
  if (days >= 12.5) {
    const weeks = Math.round(days / 7)
    return weeks === 1 ? 'every week' : `every ${weeks} weeks`
  }
  return `every ${Math.round(days)} days`
}

/** "today", "yesterday", "5 days ago", "3 weeks ago" */
export function ago(days: number): string {
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days >= 14) return `${Math.round(days / 7)} weeks ago`
  return `${Math.floor(days)} days ago`
}

/** "5 min", "1 hour", "4 hours", "1 day" */
export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) {
    const hours = Math.round(minutes / 6) / 10
    return hours === 1 ? '1 hour' : `${hours} hours`
  }
  const days = Math.round(minutes / 144) / 10
  return days === 1 ? '1 day' : `${days} days`
}
