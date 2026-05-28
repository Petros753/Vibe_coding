import { View, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../src/api/auth'
import { useAuthStore } from '../../src/store/auth.store'

export default function ProfileScreen() {
  const router    = useRouter()
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
      <View className="flex-1 px-6 pt-6">
        <Text className="text-2xl font-bold text-slate-900 mb-6">Профиль</Text>

        <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <View className="w-16 h-16 rounded-full bg-primary-100 items-center justify-center mb-4">
            <Text className="text-3xl">👤</Text>
          </View>
          <Text className="text-base font-semibold text-slate-900">Жилец</Text>
          <Text className="text-sm text-slate-500">ЖК МойДом</Text>
        </View>

        <TouchableOpacity
          className="h-12 rounded-xl bg-red-50 border border-red-200 items-center justify-center mt-auto mb-4"
          onPress={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <Text className="text-sm font-semibold text-red-600">Выйти из аккаунта</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
