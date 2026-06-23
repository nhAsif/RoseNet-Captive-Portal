// Small reusable, design-system styled primitives shared across views.

export function Card({ className = '', children }) {
  return (
    <div
      className={`rounded-base border border-line bg-neutral-soft p-5 shadow-sm sm:p-6 ${className}`}
    >
      {children}
    </div>
  )
}

export function CardTitle({ icon: Icon, children, className = '' }) {
  return (
    <h3
      className={`mb-6 flex items-center gap-3 text-base font-semibold text-heading ${className}`}
    >
      {Icon && <Icon className="h-5 w-5 text-brand" />}
      {children}
    </h3>
  )
}

export function Button({ className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-base border border-transparent bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-strong focus:outline-none focus:ring-4 focus:ring-brand-soft disabled:cursor-not-allowed disabled:border-line-medium disabled:bg-neutral-medium disabled:text-subtle disabled:shadow-none ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

const fieldClasses =
  'w-full rounded-base border border-line-medium bg-neutral-medium px-3 py-2.5 text-sm text-heading shadow-sm outline-none transition placeholder:text-subtle hover:border-line-strong focus:border-brand focus:ring-1 focus:ring-brand'

export function Input({ className = '', ...props }) {
  return <input className={`${fieldClasses} ${className}`} {...props} />
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${fieldClasses} ${className}`} {...props}>
      {children}
    </select>
  )
}

export function Field({ label, htmlFor, children, className = '' }) {
  return (
    <div className={`space-y-2 text-left ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-[13px] font-medium text-heading"
        >
          {label}
        </label>
      )}
      {children}
    </div>
  )
}

const chipStyles = {
  active: 'bg-success-soft text-success-strong border-success/30',
  expired: 'bg-danger-soft text-danger-strong border-danger/30',
  unused: 'bg-brand-softer text-brand-strong border-brand/30',
}

export function StatusChip({ status }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span
      className={`inline-block rounded-md border px-1.5 py-0.5 text-xs font-medium ${chipStyles[status] || ''}`}
    >
      {label}
    </span>
  )
}
