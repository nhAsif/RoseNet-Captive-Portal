import {
  Shield,
  LayoutDashboard,
  CreditCard,
  Users,
  MapPin,
  FileText,
  BarChart2,
  Settings,
  LogOut,
  X,
} from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'vouchers', label: 'Voucher Management', icon: CreditCard },
  { id: 'sessions', label: 'Active Sessions', icon: Users },
  { id: 'zones', label: 'Hotspot Zones', icon: MapPin },
  { id: 'logs', label: 'User Logs', icon: FileText },
  { id: 'reports', label: 'Revenue Reports', icon: BarChart2 },
]

function NavLink({ item, active, onClick }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-base border px-2 py-2 text-sm font-medium transition ${
        active
          ? 'border-brand/30 bg-neutral-strong text-brand-strong'
          : 'border-transparent text-heading hover:bg-neutral-medium'
      }`}
    >
      <Icon
        className={`h-5 w-5 transition-colors ${
          active ? 'text-brand' : 'text-body group-hover:text-heading'
        }`}
      />
      <span>{item.label}</span>
    </button>
  )
}

export default function Sidebar({ view, onNavigate, onLogout, open, onClose }) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-neutral-soft px-5 py-8 transition-transform duration-300 lg:static lg:z-10 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-base border border-brand/30 bg-brand-softer p-2 text-brand">
              <Shield className="h-5 w-5" />
            </div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-heading">
              Rose<span className="text-brand">Net</span>
            </h1>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-body hover:text-heading lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-2">
          {NAV.map((item) => (
            <NavLink
              key={item.id}
              item={item}
              active={view === item.id}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </nav>

        <div className="mt-8 border-t border-line pt-6">
          <div className="mb-6 rounded-base border border-line bg-neutral-medium p-4">
            <h4 className="mb-2 text-[11px] font-medium uppercase tracking-widest text-subtle">
              System Status
            </h4>
            <div className="flex items-center gap-2 text-sm font-medium text-success-strong">
              <span className="h-2 w-2 animate-pulseGlow rounded-full bg-success shadow-[0_0_8px_#00CC88]" />
              Server Online
            </div>
          </div>
          <div className="flex items-center justify-between px-1">
            <button
              onClick={() => onNavigate('settings')}
              className={`flex items-center justify-center rounded-base p-2 transition hover:bg-neutral-medium hover:text-brand ${
                view === 'settings' ? 'text-brand' : 'text-body'
              }`}
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={onLogout}
              className="flex items-center justify-center rounded-base p-2 text-body transition hover:bg-neutral-medium hover:text-brand"
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
