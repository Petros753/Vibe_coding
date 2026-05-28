import '../global.css'

import { useEffect, useRef, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as Notifications from 'expo-notifications'
import { queryClient } from '../src/api/client'
import { useAuthStore } from '../src/store/auth.store'
import {
  registerForPushNotifications,
  handleNotificationResponse,
  unregisterPushToken,
} from '../src/lib/notifications'

SplashScreen.preventAutoHideAsync()

// ── Auth guard + push registration ───────────────────────────────────────────

function AuthGuard() {
  const router   = useRouter()
  const segments = useSegments()
  const { accessToken, _hasHydrated } = useAuthStore()
  const prevToken = useRef<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Delay navigation until after Root Layout has fully mounted.
  // Without this, router.replace() fires before the navigator is ready,
  // causing "Attempted to navigate before mounting the Root Layout".
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !_hasHydrated) return

    SplashScreen.hideAsync()

    const inAuthGroup = segments[0] === '(auth)'

    if (!accessToken && !inAuthGroup) {
      router.replace('/(auth)/phone')
    } else if (accessToken && inAuthGroup) {
      router.replace('/(app)/')
    }
  }, [mounted, accessToken, _hasHydrated, segments])

  // Register push token after login, unregister after logout
  useEffect(() => {
    if (!_hasHydrated) return

    if (accessToken && prevToken.current !== accessToken) {
      prevToken.current = accessToken
      registerForPushNotifications()
    } else if (!accessToken && prevToken.current) {
      prevToken.current = null
      // unregisterPushToken is best-effort — already done in logout flow
    }
  }, [accessToken, _hasHydrated])

  return null
}

// ── Notification deep-link handler ────────────────────────────────────────────

function NotificationHandler() {
  const router = useRouter()
  const { _hasHydrated, accessToken } = useAuthStore()

  useEffect(() => {
    // Tap on notification while app is in foreground or background
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response, router)
    })
    return () => sub.remove()
  }, [router])

  // App launched cold by tapping a notification (killed state)
  useEffect(() => {
    if (!_hasHydrated || !accessToken) return

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response, router)
    })
  }, [_hasHydrated, accessToken])

  return null
}

// ── Root layout ───────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthGuard />
        <NotificationHandler />
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
