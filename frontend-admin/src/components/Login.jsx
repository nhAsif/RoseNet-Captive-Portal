import { useState } from 'react'
import { Shield } from 'lucide-react'
import { api } from '../lib/api.js'
import { Button, Field, Input } from './ui.jsx'

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.login(password)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Login failed')
      }
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative grid h-full place-items-center overflow-hidden bg-neutral-primary px-4">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -right-36 -top-36 h-[500px] w-[500px] rounded-full bg-brand opacity-[0.06] blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-36 -left-36 h-[500px] w-[500px] rounded-full bg-brand opacity-[0.06] blur-[140px]" />

      <div className="relative z-10 w-full max-w-md rounded-base border border-line-medium bg-neutral-soft/85 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-12">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-base border border-brand/30 bg-brand-softer text-brand shadow-sm">
          <Shield className="h-7 w-7" />
        </div>
        <h1 className="mb-2 font-display text-3xl font-semibold tracking-tight text-heading">
          Rose<span className="text-brand">Net</span> Admin
        </h1>
        <p className="mb-10 text-sm text-body">
          Enter password to access control panel
        </p>

        <form onSubmit={submit} className="space-y-6">
          <Field label="Security Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </Field>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Authenticating…' : 'Authenticate'}
          </Button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      </div>
    </div>
  )
}
