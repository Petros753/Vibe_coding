import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { authApi } from '../../src/api/auth'
import { profileApi } from '../../src/api/profile'
import { useAuthStore } from '../../src/store/auth.store'
import { unregisterPushToken } from '../../src/lib/notifications'

export default function ProfileScreen() {
  const router    = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn:  profileApi.getProfile,
  })

  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Житель'
  const apartment   = profile?.residents?.[0]?.apartment?.number
  const complexName = profile?.residents?.[0]?.apartment?.entrance?.building?.complex?.name

  const logout = useMutation({
    mutationFn: async () => {
      await unregisterPushToken()
      return authApi.logout()
    },
    onSettled: () => {
      clearAuth()
      router.replace('/(auth)/phone')
    },
  })

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="px-5 py-4 bg-white border-b border-slate-100">
        <Text className="text-xl font-bold text-slate-900">Профиль</Text>
      </View>

      <View className="flex-1 px-5 pt-5">
        {/* ── User card ────────────────────────────────────────────── */}
        <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <View className="flex-row items-center gap-4">
            <View className="w-14 h-14 rounded-full bg-primary-100 items-center justify-center">
              <Text className="text-2xl">👤</Text>
            </View>
            <View className="flex-1">
              {isLoading ? (
                <ActivityIndicator color="#2563EB" size="small" />
              ) : (
                <>
                  <Text className="text-base font-bold text-slate-900">{displayName}</Text>
                  {complexName && (
                    <Text className="text-sm text-slate-500 mt-0.5">{complexName}</Text>
                  )}
                  {apartment && (
                    <Text className="text-xs text-primary-600 mt-0.5 font-medium">
                      Квартира {apartment}
                    </Text>
                  )}
                </>
              )}
            </View>
          </View>
        </View>

        {/* ── Residence list ───────────────────────────────────────── */}
        {(profile?.residents?.length ?? 0) > 0 && (
          <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Квартиры
            </Text>
            {profile?.residents.map((r) => (
              <View key={r.id} className="flex-row items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <View>
                  <Text className="text-sm font-semibold text-slate-800">
                    Кв. {r.apartment.number}
                  </Text>
                  <Text className="text-xs text-slate-400">
                    {r.apartment.entrance.building.complex.name} · Подъезд {r.apartment.entrance.number}
                  </Text>
                </View>
                <View className={`rounded-full px-2 py-0.5 ${r.isVerified ? 'bg-green-100' : 'bg-amber-100'}`}>
                  <Text className={`text-xs font-medium ${r.isVerified ? 'text-green-700' : 'text-amber-700'}`}>
                    {r.isVerified ? '✓ Верифицирован' : '⏳ Ожидает'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Logout ───────────────────────────────────────────────── */}
        <TouchableOpacity
          className="mt-auto mb-4 h-12 rounded-xl bg-red-50 border border-red-200 items-center justify-center"
          onPress={() => logout.mutate()}
          disabled={logout.isPending}
        >
          {logout.isPending ? (
            <ActivityIndicator color="#EF4444" size="small" />
          ) : (
            <Text className="text-sm font-semibold text-red-600">Выйти из аккаунта</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
