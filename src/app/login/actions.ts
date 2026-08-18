"use server"

import fs from "node:fs/promises"
import path from "node:path"
import { redirect } from "next/navigation"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { setSessionCookie } from "@/lib/auth/session"
import { audit } from "@/lib/audit/logger"

export interface LoginState {
  error?: string
}

const ENV_PATH = path.join(process.cwd(), ".env")

async function persistPasswordHash(hash: string): Promise<void> {
  let content = ""
  try {
    content = await fs.readFile(ENV_PATH, "utf8")
  } catch {
    // .env doesn't exist yet — start from the example file's contents so other defaults survive.
    try {
      content = await fs.readFile(path.join(process.cwd(), ".env.example"), "utf8")
    } catch {
      content = ""
    }
  }
  if (/^AUTH_PASSWORD_HASH=.*$/m.test(content)) {
    content = content.replace(/^AUTH_PASSWORD_HASH=.*$/m, `AUTH_PASSWORD_HASH="${hash}"`)
  } else {
    content += `\nAUTH_PASSWORD_HASH="${hash}"\n`
  }
  await fs.writeFile(ENV_PATH, content, "utf8")
  process.env.AUTH_PASSWORD_HASH = hash // apply immediately for this running process
}

/** First-run bootstrap (brief §51 step 1): no password configured yet, so this form creates one. */
export async function bootstrapPasswordAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (process.env.AUTH_PASSWORD_HASH) {
    return { error: "A password is already configured. Use the sign-in form instead." }
  }
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")
  if (password.length < 8) return { error: "Password must be at least 8 characters." }
  if (password !== confirm) return { error: "Passwords do not match." }

  const email = process.env.AUTH_USER_EMAIL ?? "you@example.com"
  await persistPasswordHash(hashPassword(password))
  await setSessionCookie(email)
  await audit("auth.password_bootstrapped", "User", email)
  redirect("/onboarding")
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")
  const expectedEmail = process.env.AUTH_USER_EMAIL ?? "you@example.com"
  const expectedHash = process.env.AUTH_PASSWORD_HASH

  if (!expectedHash) return { error: "No password configured yet." }
  if (email.trim().toLowerCase() !== expectedEmail.trim().toLowerCase() || !verifyPassword(password, expectedHash)) {
    await audit("auth.login_failed", "User", email)
    return { error: "Incorrect email or password." }
  }

  await setSessionCookie(expectedEmail)
  await audit("auth.login_succeeded", "User", expectedEmail)
  redirect("/dashboard")
}
