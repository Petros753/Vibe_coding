import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { chatApi, ChatRoom } from '../../../src/api/chat'

const ROOM_EMOJI: Record<ChatRoom['type'], string> = {
  complex:      '🏘️',
  entrance:     '🚪',
  apartment_uk: '🏢',
}

const ROOM_TYPE_LABEL: Record<ChatRoom['type'], string> = {
  complex:      'Общий чат ЖК',
  entrance:     'Чат подъезда',
  apartment_uk: 'Чат с УК',
}

export default function ChatRoomsScreen() {
  const router = useRouter()

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn:  chatApi.getRooms,
  })

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="px-5 py-4 bg-white border-b border-slate-100">
        <Text className="text-xl font-bold text-slate-900">Чат</Text>
        <Text className="text-xs text-slate-400 mt-0.5">Общение с соседями и управляющей компанией</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#2563EB" size="large" />
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="bg-white rounded-2xl p-4 flex-row items-center gap-4 shadow-sm"
              onPress={() => router.push(`/(app)/chat/${encodeURIComponent(item.id)}`)}
              activeOpacity={0.7}
            >
              <View className="w-12 h-12 rounded-2xl bg-primary-50 items-center justify-center">
                <Text className="text-2xl">{ROOM_EMOJI[item.type]}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-900" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-xs text-slate-400 mt-0.5">{ROOM_TYPE_LABEL[item.type]}</Text>
              </View>
              <Text className="text-slate-300 text-xl">›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-4xl mb-3">💬</Text>
              <Text className="text-base font-semibold text-slate-700">Чатов нет</Text>
              <Text className="text-sm text-slate-400 mt-1 text-center px-8">
                Чаты появятся после верификации квартиры
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
