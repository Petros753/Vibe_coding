import '../global.css'

import React, { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
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
} from '../src/lib/notifications'

SplashScreen.preventAutoHideAsync()

// ── Error boundary — shows real error instead of a blank crash ────────────────

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message + '\n\n' + error.stack }
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, padding: 40, backgroundColor: 'white' }}>
          <Text style={{ color: 'red', fontSize: 13, fontFamily: 'monospace' }}>
            {this.state.error}
          </Text>
        </View>
      )
    }
    return this.props.children
  }
}

// ── Auth guard + push registration ───────────────────────────────────────────

function AuthGuard() {
  const router   = useRouter()
  const segments = useSegments()
  const { accessToken, _hasHydrated } = useAuthStore()
  const prevToken = useRef<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Safety timeout: if SecureStore hydration never completes (async failure),
  // force _hasHydrated=true after 3s so the app doesn't stay on splash forever.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!useAuthStore.getState()._hasHydrated) {
        console.warn('[Auth] Hydration timeout — forcing setHydrated(true)')
        useAuthStore.getState().setHydrated(true)
      }
    }, 3000)
    return () => clearTimeout(timeout)
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
    }
  }, [accessToken, _hasHydrated])

  return null
}

// ── Notification deep-link handler ────────────────────────────────────────────

function NotificationHandler() {
  const router = useRouter()
  const { _hasHydrated, accessToken } = useAuthStore()

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response, router)
    })
    return () => sub.remove()
  }, [router])

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
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  )
}
