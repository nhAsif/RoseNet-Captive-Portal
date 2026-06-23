// Convert a duration in minutes to a human-friendly string.
export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} hours`
  return `${(minutes / 1440).toFixed(1)} days`
}

// Determine a voucher's status: 'unused' | 'active' | 'expired'.
export function voucherStatus(voucher) {
  if (!voucher.is_used) return 'unused'
  const start = new Date(voucher.start_time).getTime()
  const expires = start + voucher.duration * 60000
  return Date.now() > expires ? 'expired' : 'active'
}
