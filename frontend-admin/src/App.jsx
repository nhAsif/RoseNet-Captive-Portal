import { useCallback, useEffect, useState } from 'react'
import { api } from './lib/api.js'
import { CurrencyContext } from './lib/currency.js'
import Login from './components/Login.jsx'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import Dashboard from './views/Dashboard.jsx'
import Vouchers from './views/Vouchers.jsx'
import Settings from './views/Settings.jsx'
import { Card, CardTitle } from './components/ui.jsx'

const COMING_SOON = {
  sessions: 'Active Sessions',
  zones: 'Hotspot Zones',
  logs: 'User Logs',
  reports: 'Revenue Reports',
}

// Decorative background grid + ambient glows (matches the design system).
function Backdrop() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundSize: '50px 50px',
          backgroundImage:
            'linear-gradient(to right, rgba(244,65,116,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(244,65,116,0.03) 1px, transparent 1px)',
          maskImage:
            'radial-gradient(circle at center, black 50%, transparent 100%)',
        }}
      />
      <div className="pointer-events-none absolute -right-36 -top-36 z-0 h-[500px] w-[500px] rounded-full bg-brand opacity-[0.06] blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-36 -left-36 z-0 h-[500px] w-[500px] rounded-full bg-brand opacity-[0.06] blur-[140px]" />
    </>
  )
}

function ComingSoon({ title }) {
  return (
    <Card className="animate-fadeIn">
      <CardTitle>{title} (Coming Soon)</CardTitle>
    </Card>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(null) // null = still checking
  const [view, setView] = useState('dashboard')
  const [currency, setCurrency] = useState('$')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Probe an authenticated endpoint to decide login state on first load.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await api.stats()
        if (active) setAuthed(res.ok)
      } catch {
        if (active) setAuthed(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // Load currency once authenticated so all views show the right symbol.
  useEffect(() => {
    if (!authed) return
    ;(async () => {
      try {
        const res = await api.settings()
        if (res.ok) {
          const s = await res.json()
          if (s.currency_symbol) setCurrency(s.currency_symbol)
        }
      } catch {
        /* keep default */
      }
    })()
  }, [authed])

  const handleLogout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setAuthed(false)
      setView('dashboard')
    }
  }, [])

  const navigate = useCallback((v) => {
    setView(v)
    setSidebarOpen(false)
  }, [])

  if (authed === null) {
    return (
      <div className="grid h-full place-items-center bg-neutral-primary text-subtle">
        Loading…
      </div>
    )
  }

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      <div className="relative flex h-full overflow-hidden">
        <Backdrop />
        <Sidebar
          view={view}
          onNavigate={navigate}
          onLogout={handleLogout}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6">
            <Topbar
              onMenu={() => setSidebarOpen(true)}
              search={search}
              onSearch={setSearch}
            />
            <main className="flex-1">
              {view === 'dashboard' && (
                <Dashboard onUnauthorized={handleLogout} />
              )}
              {view === 'vouchers' && (
                <Vouchers onUnauthorized={handleLogout} search={search} />
              )}
              {view === 'settings' && <Settings onUnauthorized={handleLogout} />}
              {COMING_SOON[view] && <ComingSoon title={COMING_SOON[view]} />}
            </main>
          </div>
        </div>
      </div>
    </CurrencyContext.Provider>
  )
}
