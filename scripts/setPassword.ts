/**
 * CLI alternative to the login page's first-run bootstrap — useful in
 * Docker/production where you don't want to expose password creation over
 * HTTP. Usage: npm run auth:set-password -- "your-password-here"
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

  await fs.writeFile(envPath, content, "utf8")
  console.log("Password hash written to .env. Restart the server for it to take effect.")
}

main()
