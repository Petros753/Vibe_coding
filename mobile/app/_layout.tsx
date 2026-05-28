import '../global.css'

import React, { useEffect, useRef, useState } from 'react'
import { Text, View, ScrollView } from 'react-native'
import {
  Stack,
  useRouter,
  useSegments,
  useRootNavigationState,
} from 'expo-router'
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

// ── Error display ─────────────────────────────────────────────────────────────

function ErrorScreen({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScrollView contentContainerStyle={{ padding: 40 }}>
        <Text style={{ color: 'red', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
          {title}
        </Text>
        <Text style={{ color: '#333', fontSize: 12, fontFamily: 'monospace', lineHeight: 18 }}>
          {detail}
        </Text>
      </ScrollView>
    </View>
  )
}

// ── Error boundary — catches synchronous render errors in children ────────────

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message + '\n\n' + error.stack }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] caught:', error.message, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return <ErrorScreen title="React render error" detail={this.state.error} />
    }
    return this.props.children
  }
}

// ── Root layout ───────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Catch errors that React error boundaries miss: async throws, useEffect errors.
  useEffect(() => {
    console.log('[Layout] mounting — installing global error handler')
    const prev = (ErrorUtils as any).getGlobalHandler()
    ;(ErrorUtils as any).setGlobalHandler((error: Error, isFatal?: boolean) => {
      console.error('[GlobalHandler] isFatal=' + isFatal, error?.message, error?.stack)
      setGlobalError(
        `[${isFatal ? 'FATAL' : 'non-fatal'}]\n${error?.message}\n\n${error?.stack ?? ''}`
      )
      prev?.(error, isFatal)
    })
    return () => {
      ;(ErrorUtils as any).setGlobalHandler(prev)
    }
  }, [])

  const router   = useRouter()
  const segments = useSegments()
  const navState = useRootNavigationState()
  const { accessToken, _hasHydrated } = useAuthStore()
  const prevToken = useRef<string | null>(null)

  const navigatorReady = navState?.key != null

  console.log(
    '[Layout] render — navigatorReady:', navigatorReady,
    '_hasHydrated:', _hasHydrated,
    'accessToken:', !!accessToken,
    'segments[0]:', segments[0],
  )

  // Safety net: force-hydrate if SecureStore never resolves.
  useEffect(() => {
    console.log('[Layout] hydration-timeout effect mounted')
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
    console.log('[Layout] auth effect — navigatorReady:', navigatorReady, '_hasHydrated:', _hasHydrated)
    if (!navigatorReady || !_hasHydrated) return

    try {
      SplashScreen.hideAsync().catch((e) => console.warn('[SplashScreen] hideAsync error:', e))

      const inAuth = segments[0] === '(auth)'
      console.log('[Layout] navigating — inAuth:', inAuth, 'accessToken:', !!accessToken)

      if (!accessToken && !inAuth) {
        console.log('[Layout] → replace /(auth)/phone')
        router.replace('/(auth)/phone')
      } else if (accessToken && inAuth) {
        console.log('[Layout] → replace /(app)/')
        router.replace('/(app)/')
      } else {
        console.log('[Layout] → no redirect needed')
      }
    } catch (e: any) {
      console.error('[Layout] auth effect error:', e?.message, e?.stack)
      setGlobalError(`[auth effect]\n${e?.message}\n\n${e?.stack ?? ''}`)
    }
  }, [navigatorReady, _hasHydrated, accessToken, segments])

  // Push token registration.
  useEffect(() => {
    console.log('[Layout] push effect — _hasHydrated:', _hasHydrated, 'accessToken:', !!accessToken)
    if (!_hasHydrated) return

    try {
      if (accessToken && prevToken.current !== accessToken) {
        prevToken.current = accessToken
        registerForPushNotifications().catch((e) =>
          console.warn('[Push] register failed:', e)
        )
      } else if (!accessToken && prevToken.current) {
        prevToken.current = null
      }
    } catch (e: any) {
      console.error('[Layout] push effect error:', e?.message)
    }
  }, [accessToken, _hasHydrated])

  // Notification listener.
  useEffect(() => {
    console.log('[Layout] notification listener mounted')
    try {
      const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('[Layout] notification tapped')
        handleNotificationResponse(response, router)
      })
      return () => sub.remove()
    } catch (e: any) {
      console.error('[Layout] notification listener error:', e?.message)
    }
  }, [router])

  // Cold-start notification.
  useEffect(() => {
    if (!navigatorReady || !_hasHydrated || !accessToken) return
    console.log('[Layout] checking last notification')
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleNotificationResponse(response, router)
      })
      .catch((e) => console.warn('[Layout] getLastNotification error:', e))
  }, [navigatorReady, _hasHydrated, accessToken])

  // Show global error on screen (errors in useEffect, async throws, etc.)
  if (globalError) {
    return <ErrorScreen title="Global JS error" detail={globalError} />
  }

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
