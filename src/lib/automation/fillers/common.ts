import type { Page } from "playwright"

/**
 * Field-filling helper that never relies on a single fragile selector
 * (brief §47): tries the accessible label first, then common name/id/
 * placeholder patterns, and reports which strategy worked (or that nothing
 * matched) so the caller can log precisely instead of failing silently.
 */
export async function fillByLabelOrFallback(
  page: Page,
  labelPatterns: (string | RegExp)[],
  value: string,
  fallbackSelectors: string[] = []
): Promise<{ filled: boolean; strategy?: string }> {
  for (const pattern of labelPatterns) {
    try {
      const field = page.getByLabel(pattern, { exact: false }).first()
      if (await field.isVisible({ timeout: 800 }).catch(() => false)) {
        await field.fill(value)
        return { filled: true, strategy: `label:${pattern}` }
      }
    } catch {
      // try next strategy
    }
  }
  for (const selector of fallbackSelectors) {
    try {
      const field = page.locator(selector).first()
      if (await field.isVisible({ timeout: 500 }).catch(() => false)) {
        await field.fill(value)
        return { filled: true, strategy: `selector:${selector}` }
      }
    } catch {
      // try next
    }
  }
  return { filled: false }
}

export async function uploadByLabelOrFallback(
  page: Page,
  labelPatterns: (string | RegExp)[],
  filePath: string,
  fallbackSelectors: string[] = ['input[type="file"]']
): Promise<{ filled: boolean; strategy?: string }> {
  for (const pattern of labelPatterns) {
    try {
      const field = page.getByLabel(pattern, { exact: false }).first()
      if (await field.count()) {
        await field.setInputFiles(filePath)
        return { filled: true, strategy: `label:${pattern}` }
      }
    } catch {
      // try next
    }
  }
  for (const selector of fallbackSelectors) {
    try {
      const field = page.locator(selector).first()
      if (await field.count()) {
        await field.setInputFiles(filePath)
        return { filled: true, strategy: `selector:${selector}` }
      }
    } catch {
      // try next
    }
  }
  return { filled: false }
}
