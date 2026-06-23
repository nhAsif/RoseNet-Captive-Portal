import { useEffect, useState } from 'react'
import { Sliders, KeyRound } from 'lucide-react'
import { api, asJson } from '../lib/api.js'
import { useCurrency } from '../lib/currency.js'
import { Card, CardTitle, Button, Input, Select, Field } from '../components/ui.jsx'

const THEMES = [
  { value: 'default', label: 'RoseNet (Matrix Pink)' },
  { value: 'modern', label: 'QuickConnect (Clean Modern)' },
  { value: 'corporate', label: 'GlobalNet (ISP Corporate)' },
  { value: 'music', label: 'AsifNET (Retro Music)' },
]

function Message({ message }) {
  if (!message?.text) return null
  return (
    <p
      className={`mt-4 text-sm ${message.ok ? 'text-success-strong' : 'text-danger'}`}
    >
      {message.text}
    </p>
  )
}

export default function Settings({ onUnauthorized }) {
  const { currency, setCurrency } = useCurrency()
  const [symbol, setSymbol] = useState(currency)
  const [theme, setTheme] = useState('default')
  const [generalMsg, setGeneralMsg] = useState(null)

  const [pw, setPw] = useState({ old: '', next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await api.settings()
        if (res.status === 401) return onUnauthorized()
        const s = await asJson(res, 'Failed to load settings')
        if (s.currency_symbol) setSymbol(s.currency_symbol)
        if (s.active_theme) setTheme(s.active_theme)
      } catch {
        /* keep defaults */
      }
    })()
  }, [onUnauthorized])

  const saveGeneral = async (e) => {
    e.preventDefault()
    setGeneralMsg(null)
    try {
      const res = await api.updateSettings({
        currency_symbol: symbol.trim(),
        active_theme: theme,
      })
      if (res.status === 401) return onUnauthorized()
      await asJson(res, 'Failed to update settings')
      setCurrency(symbol.trim())
      setGeneralMsg({ ok: true, text: 'Settings saved successfully!' })
    } catch (err) {
      setGeneralMsg({ ok: false, text: err.message })
    }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    setPwMsg(null)
    if (pw.next !== pw.confirm) {
      setPwMsg({ ok: false, text: 'New passwords do not match.' })
      return
    }
    try {
      const res = await api.changePassword(pw.old, pw.next)
      if (res.status === 401) return onUnauthorized()
      await asJson(res, 'Failed to change password')
      setPw({ old: '', next: '', confirm: '' })
      setPwMsg({ ok: true, text: 'Password changed successfully!' })
    } catch (err) {
      setPwMsg({ ok: false, text: err.message })
    }
  }

  return (
    <div className="animate-fadeIn space-y-6">
      <Card>
        <CardTitle icon={Sliders}>General Settings</CardTitle>
        <form onSubmit={saveGeneral} className="max-w-md space-y-6">
          <Field label="Currency Symbol">
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="e.g., $, €, £"
            />
          </Field>
          <Field label="Portal Theme">
            <Select value={theme} onChange={(e) => setTheme(e.target.value)}>
              {THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Save Settings</Button>
          <Message message={generalMsg} />
        </form>
      </Card>

      <Card>
        <CardTitle icon={KeyRound}>Change Admin Password</CardTitle>
        <form onSubmit={changePassword} className="max-w-md space-y-6">
          <Field label="Current Password">
            <Input
              type="password"
              value={pw.old}
              onChange={(e) => setPw({ ...pw, old: e.target.value })}
              required
            />
          </Field>
          <Field label="New Password">
            <Input
              type="password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              required
            />
          </Field>
          <Field label="Confirm New Password">
            <Input
              type="password"
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              required
            />
          </Field>
          <Button type="submit">Change Password</Button>
          <Message message={pwMsg} />
        </form>
      </Card>
    </div>
  )
}
