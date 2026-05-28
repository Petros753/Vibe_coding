import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { announcementsApi, Announcement } from '../../../src/api/announcements'

function AnnouncementCard({ item, onPress }: { item: Announcement; onPress: () => void }) {
  const date = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'long',
      })
    : new Date(item.createdAt).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'long',
      })

  return (
    <TouchableOpacity
      className={`mx-4 mb-3 bg-white rounded-2xl overflow-hidden shadow-sm ${
        item.isPinned ? 'border border-primary-200' : ''
      }`}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {item.imageUrl && (
        <Image
          source={{ uri: item.imageUrl }}
          className="w-full h-40"
          resizeMode="cover"
        />
      )}
      <View className="p-4">
        <View className="flex-row items-center gap-2 mb-2">
          {item.isPinned && (
            <View className="flex-row items-center gap-1 bg-primary-50 border border-primary-100 rounded-full px-2 py-0.5">
              <Text className="text-xs">📌</Text>
              <Text className="text-xs font-semibold text-primary-600">Закреплено</Text>
            </View>
          )}
          <Text className="text-xs text-slate-400 ml-auto">{date}</Text>
        </View>

        <Text className="text-base font-bold text-slate-900 mb-1" numberOfLines={2}>
          {item.title}
        </Text>
        <Text className="text-sm text-slate-500 leading-5" numberOfLines={3}>
          {item.body}
        </Text>

        <View className="flex-row items-center justify-end mt-3">
          <Text className="text-xs font-semibold text-primary-600">Читать →</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function AnnouncementsScreen() {
  const router = useRouter()

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['announcements'],
    queryFn:  () => announcementsApi.getAll({ limit: 30 }),
  })

  const announcements = data?.data ?? []

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View className="px-5 py-4 bg-white border-b border-slate-100">
        <Text className="text-xl font-bold text-slate-900">Объявления</Text>
        <Text className="text-xs text-slate-400 mt-0.5">Новости и уведомления от управляющей компании</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#2563EB" size="large" />
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <AnnouncementCard
              item={item}
              onPress={() => router.push(`/(app)/announcements/${item.id}`)}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563EB" />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-4xl mb-3">📢</Text>
              <Text className="text-base font-semibold text-slate-700">Объявлений пока нет</Text>
              <Text className="text-sm text-slate-400 mt-1">Здесь будут новости от УК</Text>
            </View>
          }
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 24, flexGrow: 1 }}
        />
      )}
    </SafeAreaView>
  )
}
