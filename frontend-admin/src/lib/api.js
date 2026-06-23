// Thin wrapper around the Go backend's /admin/* JSON API.
// All requests are same-origin and rely on the session cookie set by /admin/login.

function req(path, options = {}) {
  return fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
}

// Parse a JSON response or throw an Error carrying the server's message.
export async function asJson(res, fallback = 'Request failed') {
  if (!res.ok) {
    let message = fallback
    try {
      const data = await res.json()
      message = data.error || fallback
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message)
  }
  return res.json()
}

export const api = {
  login: (password) =>
    req('/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => req('/admin/logout', { method: 'POST' }),
  stats: () => req('/admin/stats'),
  vouchers: () => req('/admin/vouchers'),
  addVoucher: (voucher) =>
    req('/admin/add', { method: 'POST', body: JSON.stringify(voucher) }),
  deleteVoucher: (id) =>
    req('/admin/delete', { method: 'POST', body: JSON.stringify({ id }) }),
  settings: () => req('/admin/settings'),
  updateSettings: (settings) =>
    req('/admin/update-settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),
  changePassword: (old_password, new_password) =>
    req('/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ old_password, new_password }),
    }),
}
