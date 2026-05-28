import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../src/api/auth'
import { useAuthStore } from '../../src/store/auth.store'

export default function HomeScreen() {
  const router   = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const logout = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearAuth()
      router.replace('/(auth)/phone')
    },
  })

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>

        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Text className="text-sm text-slate-500">Добро пожаловать</Text>
            <Text className="text-2xl font-bold text-slate-900">МойДом</Text>
          </View>
          <TouchableOpacity
            className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center"
            onPress={() => router.push('/(app)/profile')}
          >
            <Text className="text-lg">👤</Text>
          </TouchableOpacity>
        </View>

        {/* Quick actions */}
        <Text className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Быстрые действия
        </Text>
        <View className="flex-row flex-wrap gap-3 mb-6">
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              className="flex-1 min-w-[40%] bg-white rounded-2xl p-4 shadow-sm items-center gap-2"
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.7}
            >
              <Text className="text-3xl">{action.emoji}</Text>
              <Text className="text-xs font-medium text-slate-700 text-center">{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout (dev) */}
        <TouchableOpacity
          className="mt-8 h-12 rounded-xl bg-red-50 border border-red-200 items-center justify-center"
          onPress={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <Text className="text-sm font-semibold text-red-600">Выйти из аккаунта</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

const QUICK_ACTIONS = [
  { label: 'Подать заявку',    emoji: '🔧', route: '/(app)/tickets'       },
  { label: 'Показания счётчиков', emoji: '📊', route: '/(app)/tickets'    },
  { label: 'Объявления',       emoji: '📢', route: '/(app)/announcements' },
  { label: 'Чат с УК',         emoji: '💬', route: '/(app)/chat'          },
]
