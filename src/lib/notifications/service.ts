import { getSettings } from "@/lib/config/settings"
import { channelRegistry, dashboardChannel } from "./channels"
import type { NotificationInput } from "./types"

/**
 * Notification Service (brief §26). Always writes to the dashboard channel
 * (so nothing is ever silently lost even with no channels configured), then
 * fans out to whatever the user enabled in Settings > Notifications.
 */
export async function notify(input: NotificationInput): Promise<void> {
  const settings = await getSettings()
  const enabledChannels = new Set(settings.notificationPrefs.channels ?? ["dashboard"])
  enabledChannels.add("dashboard")

  await Promise.all(
    Array.from(enabledChannels).map(async (channelId) => {
      const channel = channelRegistry[channelId]
      if (!channel) return
      try {
        await channel.send(input)
      } catch (err) {
        console.error(`[notify] channel ${channelId} failed`, err)
      }
    })
  )
}

export { dashboardChannel }
