// Rule-based auto-categorization: "if note contains X -> category Y".
// Device-local only (localStorage, per-user-keyed) — this is a convenience
// shortcut for data entry, not app data, so it doesn't need cloud sync or a
// Supabase table (matches the existing pattern for other per-device state).

export interface CategoryRule {
  id: string
  pattern: string // matched case-insensitively as a substring of the note
  category: string
}

function storageKey(userId: string): string {
  return `category-rules:${userId}`
}

export function getRules(userId: string): CategoryRule[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || '[]')
  } catch {
    return []
  }
}

export function addRule(userId: string, pattern: string, category: string): void {
  const rules = getRules(userId)
  rules.push({ id: crypto.randomUUID?.() ?? String(Date.now()), pattern: pattern.trim(), category })
  localStorage.setItem(storageKey(userId), JSON.stringify(rules))
}

export function deleteRule(userId: string, id: string): void {
  const rules = getRules(userId).filter(r => r.id !== id)
  localStorage.setItem(storageKey(userId), JSON.stringify(rules))
}

// First matching rule wins (list order = precedence). Returns null if the
// note is empty or nothing matches, so callers can leave category untouched.
export function matchRule(userId: string, note: string): string | null {
  if (!note.trim()) return null
  const lower = note.toLowerCase()
  const rules = getRules(userId)
  for (const rule of rules) {
    if (rule.pattern && lower.includes(rule.pattern.toLowerCase())) return rule.category
  }
  return null
}
