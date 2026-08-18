import type { Page } from "playwright"

/**
 * CAPTCHA / login-wall / unexpected-page heuristics (brief §33, §49). We
 * never attempt to solve or bypass any of these — detection only exists to
 * pause safely and notify a human (ARCHITECTURE.md §12).
 */
export async function detectCaptcha(page: Page): Promise<boolean> {
  const indicators = [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    "[data-sitekey]",
    'div[class*="captcha" i]',
    'text=/verify you are human/i',
  ]
  for (const selector of indicators) {
    try {
      const el = await page.locator(selector).first()
      if (await el.isVisible({ timeout: 500 }).catch(() => false)) return true
    } catch {
      // selector not applicable — keep checking others
    }
  }
  return false
}

export async function detectLoginWall(page: Page, expectedHost: string): Promise<boolean> {
  const url = page.url()
  if (!url.includes(expectedHost) && /login|signin|auth/i.test(url)) return true
  const passwordField = page.locator('input[type="password"]')
  return passwordField.first().isVisible({ timeout: 500 }).catch(() => false)
}

/**
 * Confirms we're actually on the application page we intended before typing
 * any personal information (brief §47). Checks the page title/body mentions
 * both the expected company and role — cheap but effective guard against a
 * silently-redirected or restructured page.
 */
export async function validateOnIntendedPage(page: Page, companyName: string, jobTitle: string): Promise<{ ok: boolean; reason: string }> {
  const text = (await page.textContent("body").catch(() => "")) ?? ""
  const lowerText = text.toLowerCase()
  const titleWords = jobTitle
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
  const titleHit = titleWords.some((w) => lowerText.includes(w))
  const companyHit = lowerText.includes(companyName.toLowerCase().split(" ")[0])
  if (!titleHit || !companyHit) {
    return { ok: false, reason: `Page content does not clearly match expected company "${companyName}" / role "${jobTitle}" — refusing to proceed.` }
  }
  return { ok: true, reason: "Page matches expected company and role." }
}
