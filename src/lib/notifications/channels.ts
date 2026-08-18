import { prisma } from "@/lib/db/client"
import { toJson } from "@/lib/utils/json"
import type { NotificationChannel, NotificationInput } from "./types"

/** Always on — every notification lands here regardless of channel prefs (brief §26). */
export const dashboardChannel: NotificationChannel = {
  id: "dashboard",
  async send(n: NotificationInput) {
    await prisma.notification.create({
      data: {
        type: n.type,
        severity: n.severity ?? "info",
        title: n.title,
        message: n.message,
        metaJson: n.meta ? toJson(n.meta) : undefined,
      },
    })
  },
}

export const consoleChannel: NotificationChannel = {
  id: "console",
  async send(n: NotificationInput) {
    console.log(`[notify:${n.severity ?? "info"}] ${n.title} — ${n.message}`)
  },
}

/**
 * Stub channels (brief §26: "do not require all of these in v1; build the
 * architecture so they can be added"). Each logs what it *would* send so
 * wiring in real credentials later is a config change (fill in the env var
 * + flip it on in Settings), not a rewrite.
 */
export const slackChannel: NotificationChannel = {
  id: "slack",
  async send(n: NotificationInput) {
    const webhook = process.env.NOTIFY_SLACK_WEBHOOK_URL
    if (!webhook) {
      console.log(`[notify:slack:not-configured] would send "${n.title}" — set NOTIFY_SLACK_WEBHOOK_URL to enable.`)
      return
    }
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `*${n.title}*\n${n.message}` }),
    }).catch((err) => console.error("[notify:slack] failed", err))
  },
}

export const telegramChannel: NotificationChannel = {
  id: "telegram",
  async send(n: NotificationInput) {
    const token = process.env.NOTIFY_TELEGRAM_BOT_TOKEN
    const chatId = process.env.NOTIFY_TELEGRAM_CHAT_ID
    if (!token || !chatId) {
      console.log(`[notify:telegram:not-configured] would send "${n.title}" — set NOTIFY_TELEGRAM_BOT_TOKEN/CHAT_ID to enable.`)
      return
    }
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `${n.title}\n${n.message}` }),
    }).catch((err) => console.error("[notify:telegram] failed", err))
  },
}

export const emailChannel: NotificationChannel = {
  id: "email",
  async send(n: NotificationInput) {
    if (!process.env.NOTIFY_EMAIL_SMTP_URL) {
      console.log(`[notify:email:not-configured] would send "${n.title}" — set NOTIFY_EMAIL_SMTP_URL to enable.`)
      return
    }
    // Intentionally not wired to a live SMTP client in this build — see ARCHITECTURE.md §15.
    console.log(`[notify:email:stub] would send "${n.title}" to ${process.env.NOTIFY_EMAIL_FROM}`)
  },
}

export const channelRegistry: Record<string, NotificationChannel> = {
  dashboard: dashboardChannel,
  console: consoleChannel,
  slack: slackChannel,
  telegram: telegramChannel,
  email: emailChannel,
}
