import '../global.css'

import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { queryClient } from '../src/api/client'
import { useAuthStore } from '../src/store/auth.store'

SplashScreen.preventAutoHideAsync()

function AuthGuard() {
  const router   = useRouter()
  const segments = useSegments()
  const { accessToken, _hasHydrated } = useAuthStore()

  useEffect(() => {
    if (!_hasHydrated) return

    SplashScreen.hideAsync()

    const inAuthGroup = segments[0] === '(auth)'

    if (!accessToken && !inAuthGroup) {
      router.replace('/(auth)/phone')
    } else if (accessToken && inAuthGroup) {
      router.replace('/(app)/')
    }
  }, [accessToken, _hasHydrated, segments])

  return null
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthGuard />
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
