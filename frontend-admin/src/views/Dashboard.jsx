import { useEffect, useState } from 'react'
import { DollarSign, Users, CheckCircle, BarChart, TrendingUp } from 'lucide-react'
import { api } from '../lib/api.js'
import { useCurrency } from '../lib/currency.js'
import { Card, CardTitle } from '../components/ui.jsx'
import {
  SalesBarChart,
  StatusDoughnutChart,
  TrafficRadarChart,
} from '../components/charts.jsx'

function StatCard({ title, value, icon: Icon, trend }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-2 text-[13px] font-medium uppercase tracking-wide text-body">
            {title}
          </div>
          <div className="text-3xl font-semibold tracking-tight text-heading">
            {value}
          </div>
        </div>
        <div className="flex items-center justify-center rounded-lg border border-line-medium bg-neutral-medium p-2.5 text-brand">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend != null && (
        <div className="mt-2 flex items-center gap-1 text-[13px] font-semibold text-success-strong">
          <TrendingUp className="h-4 w-4" />
          {trend}
        </div>
      )}
    </Card>
  )
}

export default function Dashboard({ onUnauthorized }) {
  const { currency } = useCurrency()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await api.stats()
        if (res.status === 401) return onUnauthorized()
        if (!res.ok) throw new Error('Failed to load dashboard stats')
        const data = await res.json()
        if (active) setStats(data)
      } catch (err) {
        if (active) setError(err.message)
      }
    })()
    return () => {
      active = false
    }
  }, [onUnauthorized])

  if (error) return <Card className="text-danger">{error}</Card>
  if (!stats) return <Card className="text-subtle">Loading dashboard…</Card>

  const revenue = (stats.total_revenue || 0).toLocaleString()
  const topPlans = stats.top_plans || []

  return (
    <div className="grid animate-fadeIn grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <StatCard
          title="Total Revenue"
          value={`${currency}${revenue}`}
          icon={DollarSign}
          trend={`+${stats.revenue_trend || 0}%`}
        />
      </div>
      <div className="lg:col-span-4">
        <StatCard
          title="Live Online Users"
          value={stats.live_users || 0}
          icon={Users}
        />
      </div>
      <div className="lg:col-span-4">
        <StatCard
          title="Active Vouchers"
          value={stats.active_vouchers || 0}
          icon={CheckCircle}
        />
      </div>

      <Card className="lg:col-span-8 lg:row-span-2">
        <CardTitle>Voucher Sales Statistics</CardTitle>
        <div className="h-64 sm:h-80">
          {stats.sales_stats && (
            <SalesBarChart
              labels={stats.sales_stats.labels}
              data={stats.sales_stats.data}
            />
          )}
        </div>
      </Card>

      <Card className="lg:col-span-4">
        <CardTitle>Voucher Status</CardTitle>
        <div className="h-56">
          {stats.voucher_status && (
            <StatusDoughnutChart
              active={stats.voucher_status.active}
              expired={stats.voucher_status.expired}
              unused={stats.voucher_status.unused}
            />
          )}
        </div>
      </Card>

      <div className="lg:col-span-4">
        <StatCard
          title="Total Data Consumed"
          value={`${stats.data_consumed || 0} GB`}
          icon={BarChart}
        />
      </div>

      <Card className="lg:col-span-6">
        <CardTitle>Top Selling Plans</CardTitle>
        <ul className="space-y-2">
          {topPlans.length === 0 && (
            <li className="rounded-base border border-line bg-neutral-medium px-4 py-3 text-sm">
              No plan sales data available.
            </li>
          )}
          {topPlans.map((plan) => (
            <li
              key={plan.name}
              className="flex items-center justify-between rounded-base border border-line bg-neutral-medium px-4 py-3 text-sm"
            >
              <span className="text-heading">{plan.name}</span>
              <span className="text-brand-strong">({plan.sales} sold)</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="lg:col-span-6">
        <CardTitle>Traffic by Zone</CardTitle>
        <div className="h-56">
          {stats.traffic_by_zone && (
            <TrafficRadarChart
              labels={stats.traffic_by_zone.labels}
              data={stats.traffic_by_zone.data}
            />
          )}
        </div>
      </Card>
    </div>
  )
}
