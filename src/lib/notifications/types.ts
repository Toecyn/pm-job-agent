import type { NotificationType } from "@/lib/types/enums"

export interface NotificationInput {
  type: NotificationType | string
  severity?: "info" | "success" | "warning" | "error"
  title: string
  message: string
  meta?: Record<string, unknown>
}

export interface NotificationChannel {
  id: string
  send(notification: NotificationInput): Promise<void>
}
