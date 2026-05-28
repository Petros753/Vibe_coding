import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { profileApi } from '../../src/api/profile'

const TILES = [
  { label: 'Заявки',       emoji: '🔧', route: '/(app)/tickets/',    color: 'bg-blue-50',   border: 'border-blue-100'   },
  { label: 'Домофон',      emoji: '🔔', route: null,                  color: 'bg-amber-50',  border: 'border-amber-100'  },
  { label: 'Камеры',       emoji: '📷', route: null,                  color: 'bg-slate-50',  border: 'border-slate-200'  },
  { label: 'Счётчики',     emoji: '📊', route: null,                  color: 'bg-cyan-50',   border: 'border-cyan-100'   },
  { label: 'Объявления',   emoji: '📢', route: '/(app)/announcements',color: 'bg-purple-50', border: 'border-purple-100' },
  { label: 'Чат с УК',     emoji: '💬', route: '/(app)/chat',         color: 'bg-green-50',  border: 'border-green-100'  },
] as const

export default function HomeScreen() {
  const router = useRouter()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn:  profileApi.getProfile,
  })

  const firstName  = profile?.firstName ?? ''
  const lastName   = profile?.lastName  ?? ''
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'Житель'
  const complexName = profile?.residents?.[0]?.apartment?.entrance?.building?.complex?.name ?? 'МойДом'
  const apartment   = profile?.residents?.[0]?.apartment?.number
    ? `кв. ${profile.residents[0].apartment.number}`
    : undefined

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View className="px-5 pt-4 pb-5 bg-white border-b border-slate-100">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-xs text-slate-400 mb-0.5">Добро пожаловать</Text>
              {isLoading ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <Text className="text-xl font-bold text-slate-900" numberOfLines={1}>
                  {displayName}
                </Text>
              )}
              <View className="flex-row items-center gap-1.5 mt-1">
                <Text className="text-sm text-primary-600 font-medium">{complexName}</Text>
                {apartment && (
                  <>
                    <Text className="text-slate-300">·</Text>
                    <Text className="text-sm text-slate-500">{apartment}</Text>
                  </>
                )}
              </View>
            </View>
            <TouchableOpacity
              className="w-11 h-11 rounded-full bg-primary-50 border border-primary-100 items-center justify-center"
              onPress={() => router.push('/(app)/profile')}
            >
              <Text className="text-xl">👤</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Feature tiles ───────────────────────────────────────────────── */}
        <View className="px-4 pt-5">
          <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
            Сервисы
          </Text>

          <View className="flex-row flex-wrap gap-3">
            {TILES.map((tile) => (
              <TouchableOpacity
                key={tile.label}
                className={`
                  w-[47%] rounded-2xl border p-4 min-h-[110px]
                  justify-between
                  ${tile.color} ${tile.border}
                  ${!tile.route ? 'opacity-50' : ''}
                `}
                onPress={() => tile.route && router.push(tile.route as any)}
                activeOpacity={tile.route ? 0.7 : 1}
                disabled={!tile.route}
              >
                <Text className="text-4xl">{tile.emoji}</Text>
                <View>
                  <Text className="text-sm font-semibold text-slate-800 mt-2">
                    {tile.label}
                  </Text>
                  {!tile.route && (
                    <Text className="text-xs text-slate-400 mt-0.5">Скоро</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Quick tip ───────────────────────────────────────────────────── */}
        <View className="mx-4 mt-5 bg-primary-50 border border-primary-100 rounded-2xl p-4">
          <Text className="text-sm font-semibold text-primary-700 mb-1">
            💡 Есть проблема в квартире?
          </Text>
          <Text className="text-xs text-primary-600 leading-4">
            Подайте заявку — мы оперативно примем её в работу и уведомим вас о статусе.
          </Text>
          <TouchableOpacity
            className="mt-3 bg-primary-600 rounded-xl h-9 items-center justify-center"
            onPress={() => router.push('/(app)/tickets/')}
          >
            <Text className="text-xs font-semibold text-white">Подать заявку</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
