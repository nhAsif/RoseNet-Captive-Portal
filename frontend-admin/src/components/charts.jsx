import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Bar, Doughnut, Radar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
)

ChartJS.defaults.font.family = '"JetBrains Mono", monospace'
ChartJS.defaults.color = '#888888'

// Shared palette (mirrors the design-system tokens).
export const C = {
  brand: '#F44174',
  success: '#00CC88',
  danger: '#FF3355',
  body: '#888888',
  neutralPrimary: '#050505',
  heading: '#EDEDED',
}

const grid = 'rgba(255, 255, 255, 0.03)'

export function SalesBarChart({ labels, data }) {
  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: 'Voucher Sales',
            data,
            backgroundColor: C.brand + '33',
            borderColor: C.brand,
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: grid },
            ticks: { color: C.body },
          },
          x: { grid: { display: false }, ticks: { color: C.body } },
        },
      }}
    />
  )
}

export function StatusDoughnutChart({ active, expired, unused }) {
  return (
    <Doughnut
      data={{
        labels: ['Active', 'Expired', 'Unused'],
        datasets: [
          {
            data: [active, expired, unused],
            backgroundColor: [C.success, C.danger, C.brand],
            borderWidth: 0,
            hoverOffset: 12,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: C.body, usePointStyle: true, padding: 16 },
          },
        },
      }}
    />
  )
}

export function TrafficRadarChart({ labels, data }) {
  return (
    <Radar
      data={{
        labels,
        datasets: [
          {
            label: 'Traffic',
            data,
            backgroundColor: C.brand + '15',
            borderColor: C.brand,
            pointBackgroundColor: C.brand,
            pointBorderColor: C.neutralPrimary,
            pointHoverBackgroundColor: C.heading,
            borderWidth: 1,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            angleLines: { color: grid },
            grid: { color: grid },
            pointLabels: { color: C.body, font: { size: 10 } },
            ticks: { display: false },
          },
        },
      }}
    />
  )
}
