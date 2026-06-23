import { useEffect, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { api, asJson } from '../lib/api.js'
import { useCurrency } from '../lib/currency.js'
import { Card, CardTitle, Button, Input, Select, Field, StatusChip } from '../components/ui.jsx'
import { formatDuration, voucherStatus } from '../lib/format.js'

const UNIT_TO_MINUTES = { minutes: 1, days: 24 * 60, months: 30 * 24 * 60 }

const EMPTY_FORM = {
  name: '',
  duration: '',
  unit: 'days',
  price: '',
  code: '',
  reusable: false,
}

export default function Vouchers({ onUnauthorized, search = '' }) {
  const { currency } = useCurrency()
  const [vouchers, setVouchers] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const res = await api.vouchers()
      if (res.status === 401) return onUnauthorized()
      const data = await asJson(res, 'Failed to load vouchers')
      setVouchers((data || []).sort((a, b) => b.id - a.id))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const duration = parseInt(form.duration, 10) || 0
    const payload = {
      name: form.name.trim(),
      duration: duration * (UNIT_TO_MINUTES[form.unit] || 1),
      price: parseFloat(form.price) || 0,
      is_reusable: form.reusable,
      ...(form.code.trim() && { code: form.code.trim() }),
    }
    try {
      const res = await api.addVoucher(payload)
      if (res.status === 401) return onUnauthorized()
      await asJson(res, 'Failed to add voucher')
      setForm(EMPTY_FORM)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Are you sure you want to delete this voucher?')) return
    try {
      const res = await api.deleteVoucher(id)
      if (res.status === 401) return onUnauthorized()
      await asJson(res, 'Failed to delete voucher')
      setVouchers((vs) => vs.filter((v) => v.id !== id))
    } catch (err) {
      window.alert(err.message)
    }
  }

  const query = search.trim().toLowerCase()
  const filtered = query
    ? vouchers.filter(
        (v) =>
          (v.name || '').toLowerCase().includes(query) ||
          (v.code || '').toLowerCase().includes(query) ||
          (v.user_mac || '').toLowerCase().includes(query),
      )
    : vouchers

  return (
    <div className="animate-fadeIn space-y-6">
      <Card>
        <CardTitle icon={Plus}>Add New Voucher</CardTitle>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Voucher Name (e.g., 1 Day Pass)">
              <Input
                value={form.name}
                onChange={set('name')}
                placeholder="Voucher Name"
              />
            </Field>
            <Field label="Duration">
              <Input
                type="number"
                value={form.duration}
                onChange={set('duration')}
                placeholder="e.g., 1"
                min="0"
              />
            </Field>
            <Field label="Unit">
              <Select value={form.unit} onChange={set('unit')}>
                <option value="minutes">Minutes</option>
                <option value="days">Days</option>
                <option value="months">Months</option>
              </Select>
            </Field>
            <Field label={`Price (${currency})`}>
              <Input
                type="number"
                step="0.01"
                value={form.price}
                onChange={set('price')}
                placeholder="e.g., 5.00"
                min="0"
              />
            </Field>
            <Field label="Custom Code (optional)">
              <Input
                value={form.code}
                onChange={set('code')}
                placeholder="Leave blank for random"
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-6 pt-1">
            <Button type="submit" disabled={submitting} className="w-auto px-6">
              {submitting ? 'Adding…' : 'Add Voucher'}
            </Button>
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-heading">
              <input
                type="checkbox"
                checked={form.reusable}
                onChange={set('reusable')}
                className="h-4 w-4 rounded border-line-medium bg-neutral-medium text-brand accent-brand"
              />
              Reusable
            </label>
            {error && <span className="text-sm text-danger">{error}</span>}
          </div>
        </form>
      </Card>

      <Card className="p-0 sm:p-0">
        <div className="p-5 sm:p-6">
          <CardTitle className="mb-0">Existing Vouchers</CardTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-y border-line bg-neutral-soft text-body">
                {['Name', 'Code', 'Duration', 'Price', 'Status', 'Used By', 'Actions'].map(
                  (h) => (
                    <th key={h} className="px-6 py-3 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-subtle">
                    No vouchers found.
                  </td>
                </tr>
              )}
              {filtered.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-line transition hover:bg-neutral-soft"
                >
                  <td className="px-6 py-4 font-semibold text-heading">
                    {v.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-brand-strong">{v.code}</td>
                  <td className="px-6 py-4">{formatDuration(v.duration)}</td>
                  <td className="px-6 py-4 text-heading">
                    {currency}
                    {(v.price || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <StatusChip status={voucherStatus(v)} />
                  </td>
                  <td className="px-6 py-4 text-xs text-body">
                    {v.is_used ? v.user_mac || 'N/A' : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => remove(v.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-medium bg-neutral-medium text-body transition hover:border-danger hover:bg-danger-soft hover:text-brand-strong"
                      aria-label="Delete voucher"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
