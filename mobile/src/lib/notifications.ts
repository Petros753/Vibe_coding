import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import type { Router } from 'expo-router'
import { pushApi } from '../api/push'
import { useAuthStore } from '../store/auth.store'

// ── Foreground notification display behavior ──────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
})

// ── Android channel (required for Android 8+) ─────────────────────────────────

export async function setupAndroidChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('default', {
    name:             'МойДом уведомления',
    importance:       Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor:       '#2563EB',
  })
}

// ── Token registration ────────────────────────────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] Simulator detected — skipping token registration')
    return null
  }

  // Request permission
  const { status: existing } = await Notifications.getPermissionsAsync()
  let status = existing

  if (existing !== 'granted') {
    const { status: requested } = await Notifications.requestPermissionsAsync()
    status = requested
  }

  if (status !== 'granted') {
    console.log('[Push] Permission not granted')
    return null
  }

  await setupAndroidChannel()

  // Prefer Expo push token (works with Expo Go + EAS builds via Expo's gateway)
  // Falls back to raw device token (FCM/APNs) for standalone builds
  try {
    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId

    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getDevicePushTokenAsync()

    const token    = tokenData.data
    const platform = Platform.OS as 'ios' | 'android'

    // Avoid re-registering the same token
    const stored = useAuthStore.getState().pushToken
    if (stored === token) return token

    await pushApi.registerToken(token, platform)
    useAuthStore.getState().setPushToken(token)

    console.log(`[Push] Token registered (${platform})`)
    return token
  } catch (err) {
    console.warn('[Push] Token registration failed:', err)
    return null
  }
}

// ── Unregister (on logout) ────────────────────────────────────────────────────

export async function unregisterPushToken(): Promise<void> {
  const token = useAuthStore.getState().pushToken
  if (!token) return
  try {
    await pushApi.unregisterToken(token)
    useAuthStore.getState().setPushToken(null)
  } catch (err) {
    console.warn('[Push] Token unregister failed:', err)
  }
}

// ── Deep-link navigation from notification tap ────────────────────────────────

export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  router: Router,
) {
  const data = response.notification.request.content.data as Record<string, string> | undefined
  if (!data?.type) return

  switch (data.type) {
    case 'TICKET_UPDATE':
      if (data.ticketId) {
        router.push(`/(app)/tickets/${data.ticketId}`)
      } else {
        router.push('/(app)/tickets/')
      }
      break

    case 'ANNOUNCEMENT':
      if (data.announcementId) {
        router.push(`/(app)/announcements/${data.announcementId}`)
      } else {
        router.push('/(app)/announcements/')
      }
      break

    case 'INTERCOM_CALL':
      // Placeholder until intercom screen is built
      router.push('/(app)/')
      break

    default:
      break
  }
}
