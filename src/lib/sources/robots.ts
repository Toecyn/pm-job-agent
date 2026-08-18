/**
 * Minimal robots.txt checker used before Manual Import fetches a single
 * page a human explicitly pasted a link to (brief §3, §49). This is not a
 * full crawler — it only ever fetches the one URL the user gave us, and only
 * if that path isn't disallowed for a generic user-agent.
 */
export async function isFetchAllowed(targetUrl: string): Promise<{ allowed: boolean; reason: string }> {
  let url: URL
  try {
    url = new URL(targetUrl)
  } catch {
    return { allowed: false, reason: "Not a valid URL." }
  }

  try {
    const robotsUrl = `${url.protocol}//${url.host}/robots.txt`
    const res = await fetch(robotsUrl, { headers: { Accept: "text/plain" } })
    if (!res.ok) {
      // No robots.txt, or it's unreachable — default to allowed for a single
      // user-initiated fetch (standard robots convention).
      return { allowed: true, reason: "No robots.txt found; defaulting to allowed." }
    }
    const text = await res.text()
    const disallowed = parseDisallowedPaths(text)
    const path = url.pathname
    const blocked = disallowed.some((rule) => rule && path.startsWith(rule))
    return {
      allowed: !blocked,
      reason: blocked
        ? `robots.txt disallows ${path} for all crawlers.`
        : "Path not disallowed by robots.txt.",
    }
  } catch (err) {
    return { allowed: true, reason: `robots.txt check failed (${(err as Error).message}); defaulting to allowed.` }
  }
}

function parseDisallowedPaths(robotsTxt: string): string[] {
  const lines = robotsTxt.split("\n").map((l) => l.trim())
  const disallowed: string[] = []
  let inWildcardGroup = false
  for (const line of lines) {
    if (/^user-agent:\s*\*/i.test(line)) {
      inWildcardGroup = true
      continue
    }
    if (/^user-agent:/i.test(line)) {
      inWildcardGroup = false
      continue
    }
    if (inWildcardGroup) {
      const match = line.match(/^disallow:\s*(.*)$/i)
      if (match && match[1]) disallowed.push(match[1].trim())
    }
  }
  return disallowed
}
