/** Shared helpers used by both the fit and quality scoring engines. */

export function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n))
}

/** Fraction of `needles` that appear (as a substring, case-insensitive) somewhere in `haystack`. */
export function overlapFraction(needles: string[], haystack: string[]): number {
  if (!needles.length) return 1 // nothing required -> nothing to fail
  const haystackLower = haystack.map((h) => h.toLowerCase())
  const hits = needles.filter((n) => haystackLower.some((h) => h.includes(n.toLowerCase()) || n.toLowerCase().includes(h)))
  return hits.length / needles.length
}

export function textContainsAny(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase()
  return terms.some((t) => lower.includes(t.toLowerCase()))
}

/** Weighted sum of a breakdown object against a same-keyed weights object, normalized to 0-100. */
export function weightedScore<K extends string>(
  breakdown: Record<K, number>,
  weights: Record<K, number>
): number {
  const keys = Object.keys(weights) as K[]
  const totalWeight = keys.reduce((sum, k) => sum + (weights[k] ?? 0), 0) || 1
  const sum = keys.reduce((acc, k) => acc + (breakdown[k] ?? 0) * (weights[k] ?? 0), 0)
  return clamp(Math.round(sum / totalWeight))
}
