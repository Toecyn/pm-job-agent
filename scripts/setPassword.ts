/**
 * CLI alternative to the login page's first-run bootstrap. Computes the
 * AUTH_PASSWORD_HASH value and always prints it — useful both in
 * Docker/local dev (where it also patches .env directly) and for a
 * read-only deployment like Vercel, where you generate the hash here and
 * paste it into the host's environment variables yourself (the password
 * itself never has to touch that host at all).
 *
 * Usage: npm run auth:set-password -- "your-password-here"
 */
import fs from "node:fs/promises"
import path from "node:path"
import { hashPassword } from "../src/lib/auth/password"

async function main() {
  const password = process.argv[2]
  if (!password || password.length < 8) {
    console.error('Usage: npm run auth:set-password -- "your-password-here" (min 8 characters)')
    process.exitCode = 1
    return
  }

  const hash = hashPassword(password)
  console.log(`\nAUTH_PASSWORD_HASH="${hash}"\n`)

  const envPath = path.join(process.cwd(), ".env")
  let content = ""
  try {
    content = await fs.readFile(envPath, "utf8")
  } catch {
    content = await fs.readFile(path.join(process.cwd(), ".env.example"), "utf8").catch(() => "")
  }

  content = /^AUTH_PASSWORD_HASH=.*$/m.test(content)
    ? content.replace(/^AUTH_PASSWORD_HASH=.*$/m, `AUTH_PASSWORD_HASH="${hash}"`)
    : content + `\nAUTH_PASSWORD_HASH="${hash}"\n`

  try {
    await fs.writeFile(envPath, content, "utf8")
    console.log("Also written to your local .env (restart the dev server for it to take effect).")
  } catch {
    console.log("Could not write to a local .env here — copy the value printed above into your host's environment variables instead.")
  }
}

main()
