import { View, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function AnnouncementsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center" edges={['top']}>
      <Text className="text-4xl mb-3">📢</Text>
      <Text className="text-xl font-bold text-slate-900">Объявления</Text>
      <Text className="text-sm text-slate-500 mt-1">Скоро</Text>
    </SafeAreaView>
  )
}
