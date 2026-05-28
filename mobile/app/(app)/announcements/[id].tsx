import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { announcementsApi } from '../../../src/api/announcements'

export default function AnnouncementDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>()
  const router   = useRouter()

  const { data: announcement, isLoading } = useQuery({
    queryKey: ['announcement', id],
    queryFn:  () => announcementsApi.getById(id),
    enabled:  !!id,
  })

  if (isLoading || !announcement) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={['top']}>
        <ActivityIndicator color="#2563EB" size="large" />
      </SafeAreaView>
    )
  }

  const date = announcement.publishedAt
    ? new Date(announcement.publishedAt).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : new Date(announcement.createdAt).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'long', year: 'numeric',
      })

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* ── Header ──────────────────────────────────────────── */}
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-slate-100">
        <TouchableOpacity
          className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center"
          onPress={() => router.back()}
        >
          <Text className="text-lg text-slate-700">‹</Text>
        </TouchableOpacity>
        <Text className="text-base font-semibold text-slate-900 flex-1" numberOfLines={1}>
          Объявление
        </Text>
        {announcement.isPinned && (
          <View className="flex-row items-center gap-1 bg-primary-50 rounded-full px-2 py-0.5">
            <Text className="text-xs">📌</Text>
            <Text className="text-xs font-semibold text-primary-600">Закреплено</Text>
          </View>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero image ──────────────────────────────────────── */}
        {announcement.imageUrl && (
          <Image
            source={{ uri: announcement.imageUrl }}
            className="w-full h-52"
            resizeMode="cover"
          />
        )}

        <View className="px-5 pt-5">
          {/* ── Meta ────────────────────────────────────────────── */}
          <View className="flex-row items-center gap-2 mb-3">
            <View className="w-8 h-8 rounded-full bg-primary-100 items-center justify-center">
              <Text className="text-sm">🏢</Text>
            </View>
            <View>
              <Text className="text-xs font-semibold text-slate-700">Управляющая компания</Text>
              <Text className="text-xs text-slate-400">{date}</Text>
            </View>
          </View>

          {/* ── Title ───────────────────────────────────────────── */}
          <Text className="text-2xl font-bold text-slate-900 leading-8 mb-4">
            {announcement.title}
          </Text>

          {/* ── Body ────────────────────────────────────────────── */}
          <Text className="text-base text-slate-700 leading-7">
            {announcement.body}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
