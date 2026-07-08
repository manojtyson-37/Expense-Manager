import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

function monthsBackList(monthsBack: number): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

export interface MonthlyTrendPoint {
  month: string // YYYY-MM
  income: number
  expense: number
}

// Single Dexie query + in-memory grouping — cheaper than one useTransactions
// hook per month (which would violate the rules of hooks for a dynamic count
// anyway) and reuses the same "filter by date prefix" approach as useTransactions.
export function useMonthlyTrend(monthsBack = 6) {
  return useLiveQuery(async () => {
    const months = monthsBackList(monthsBack)
    const cutoff = months[0]
    const all = await db.transactions.where('date').aboveOrEqual(`${cutoff}-01`).toArray()
    const byMonth = new Map<string, MonthlyTrendPoint>(months.map(m => [m, { month: m, income: 0, expense: 0 }]))
    for (const t of all) {
      const m = t.date.slice(0, 7)
      const point = byMonth.get(m)
      if (!point) continue // outside the requested window
      if (t.type === 'income') point.income += t.amount
      else point.expense += t.amount
    }
    return months.map(m => byMonth.get(m)!)
  }, [monthsBack])
}

export interface CategoryTrendSeries {
  category: string
  color: string
  points: { month: string; total: number }[]
}

// Top N expense categories (by total spend across the window) broken down
// per month — feeds a grouped bar chart. Categories outside the top N are
// folded away entirely (not into "Other") to keep the chart legible.
export function useCategoryTrend(monthsBack = 6, topN = 5) {
  const categories = useLiveQuery(() => db.categories.toArray())
  return useLiveQuery(async () => {
    const months = monthsBackList(monthsBack)
    const cutoff = months[0]
    const all = await db.transactions
      .where('date').aboveOrEqual(`${cutoff}-01`)
      .and(t => t.type === 'expense')
      .toArray()

    const totalByCategory = new Map<string, number>()
    for (const t of all) {
      totalByCategory.set(t.category, (totalByCategory.get(t.category) || 0) + t.amount)
    }
    const top = Array.from(totalByCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([category]) => category)
    const topSet = new Set(top)

    const perCategoryPerMonth = new Map<string, Map<string, number>>(
      top.map(c => [c, new Map(months.map(m => [m, 0]))])
    )
    for (const t of all) {
      if (!topSet.has(t.category)) continue
      const m = t.date.slice(0, 7)
      const monthMap = perCategoryPerMonth.get(t.category)
      if (!monthMap || !monthMap.has(m)) continue
      monthMap.set(m, (monthMap.get(m) || 0) + t.amount)
    }

    return top.map((category): CategoryTrendSeries => ({
      category,
      color: (categories || []).find(c => c.name === category)?.color || '#64748b',
      points: months.map(m => ({ month: m, total: perCategoryPerMonth.get(category)!.get(m) || 0 })),
    }))
  }, [monthsBack, topN, categories])
}
