import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMonthlyTrend, useCategoryTrend } from '../hooks/useTrends'
import { useCurrency } from '../lib/CurrencyContext'
import IconRenderer from '../components/IconRenderer'
import { useCategories } from '../hooks/useCategories'

function monthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}

interface MonthlyBarChartProps {
  points: { month: string; income: number; expense: number }[]
  format: (n: number) => string
}

function MonthlyBarChart({ points, format }: MonthlyBarChartProps) {
  const width = 340
  const height = 180
  const padBottom = 24
  const padTop = 8
  const chartH = height - padBottom - padTop
  const max = Math.max(1, ...points.flatMap(p => [p.income, p.expense]))
  const groupW = width / points.length
  const barW = Math.min(14, groupW / 3)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      {points.map((p, i) => {
        const cx = groupW * i + groupW / 2
        const incH = (p.income / max) * chartH
        const expH = (p.expense / max) * chartH
        return (
          <g key={p.month}>
            <rect
              x={cx - barW - 2} y={padTop + chartH - incH}
              width={barW} height={incH}
              rx="2" fill="var(--color-income)"
            />
            <rect
              x={cx + 2} y={padTop + chartH - expH}
              width={barW} height={expH}
              rx="2" fill="var(--color-expense)"
            />
            <text
              x={cx} y={height - 6}
              textAnchor="middle" fontSize="9"
              fill="var(--color-text-muted)"
            >
              {monthLabel(p.month)}
            </text>
          </g>
        )
      })}
      <title>{points.map(p => `${p.month}: income ${format(p.income)}, expense ${format(p.expense)}`).join('\n')}</title>
    </svg>
  )
}

interface CategoryStackedChartProps {
  months: string[]
  series: { category: string; color: string; points: { month: string; total: number }[] }[]
}

function CategoryStackedChart({ months, series }: CategoryStackedChartProps) {
  const width = 340
  const height = 180
  const padBottom = 24
  const padTop = 8
  const chartH = height - padBottom - padTop
  const totalsByMonth = months.map(m =>
    series.reduce((sum, s) => sum + (s.points.find(p => p.month === m)?.total || 0), 0)
  )
  const max = Math.max(1, ...totalsByMonth)
  const groupW = width / months.length
  const barW = Math.min(24, groupW * 0.6)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      {months.map((m, i) => {
        const cx = groupW * i + groupW / 2
        let yOffset = padTop + chartH
        return (
          <g key={m}>
            {series.map(s => {
              const val = s.points.find(p => p.month === m)?.total || 0
              const h = (val / max) * chartH
              yOffset -= h
              return (
                <rect
                  key={s.category}
                  x={cx - barW / 2} y={yOffset}
                  width={barW} height={h}
                  fill={s.color}
                />
              )
            })}
            <text
              x={cx} y={height - 6}
              textAnchor="middle" fontSize="9"
              fill="var(--color-text-muted)"
            >
              {monthLabel(m)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function Trends() {
  const navigate = useNavigate()
  const { format } = useCurrency()
  const monthly = useMonthlyTrend(6)
  const categoryTrend = useCategoryTrend(6, 5)
  const categories = useCategories()

  const hasData = (monthly || []).some(p => p.income > 0 || p.expense > 0)

  return (
    <div className="flex-1 px-4 pt-4 pb-8">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full active:bg-surface-light">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Trends</h1>
      </div>

      {!hasData ? (
        <div className="text-center text-text-muted py-16 text-sm">
          Not enough data yet — add a few months of transactions to see trends.
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Income vs Expense — last 6 months
            </h2>
            <div className="bg-surface rounded-2xl p-4">
              <MonthlyBarChart points={monthly!} format={format} />
              <div className="flex items-center justify-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-xs text-text-muted">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-income)' }} />
                  Income
                </span>
                <span className="flex items-center gap-1.5 text-xs text-text-muted">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-expense)' }} />
                  Expense
                </span>
              </div>
            </div>
          </div>

          {categoryTrend && categoryTrend.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                Top Categories — last 6 months
              </h2>
              <div className="bg-surface rounded-2xl p-4">
                <CategoryStackedChart
                  months={monthly!.map(p => p.month)}
                  series={categoryTrend}
                />
                <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                  {categoryTrend.map(s => {
                    const cat = categories?.find(c => c.name === s.category)
                    return (
                      <span key={s.category} className="flex items-center gap-1.5 text-xs text-text-muted">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        {cat && <IconRenderer icon={cat.icon} size={12} />}
                        {s.category}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
