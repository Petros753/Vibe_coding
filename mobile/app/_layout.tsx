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

// ── Root layout ───────────────────────────────────────────────────────────────

export default function RootLayout() {
  const router   = useRouter()
  const segments = useSegments()
  const { accessToken, _hasHydrated } = useAuthStore()
  const [ready, setReady] = useState(false)
  const prevToken = useRef<string | null>(null)

  // Give the navigator time to mount before any router.replace() call.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 100)
    return () => clearTimeout(t)
  }, [])

  // Safety timeout: force hydration if SecureStore never resolves.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!useAuthStore.getState()._hasHydrated) {
        console.warn('[Auth] Hydration timeout — forcing setHydrated(true)')
        useAuthStore.getState().setHydrated(true)
      }
    }, 3000)
    return () => clearTimeout(t)
  }, [])

  // Auth redirect.
  useEffect(() => {
    if (!ready || !_hasHydrated) return

    SplashScreen.hideAsync()

    const inAuth = segments[0] === '(auth)'
    if (!accessToken && !inAuth) {
      router.replace('/(auth)/phone')
    } else if (accessToken && inAuth) {
      router.replace('/(app)/')
    }
  }, [ready, _hasHydrated, accessToken, segments])

  // Push token registration on login / cleanup on logout.
  useEffect(() => {
    if (!_hasHydrated) return

    if (accessToken && prevToken.current !== accessToken) {
      prevToken.current = accessToken
      registerForPushNotifications()
    } else if (!accessToken && prevToken.current) {
      prevToken.current = null
    }
  }, [accessToken, _hasHydrated])

  // Deep-link from notification tap (foreground + background).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response, router)
    })
    return () => sub.remove()
  }, [router])

  // Deep-link from cold start via notification.
  useEffect(() => {
    if (!_hasHydrated || !accessToken) return
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response, router)
    })
  }, [_hasHydrated, accessToken])

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
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
