import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import {
  ticketsApi, Ticket, TicketStatus, TicketCategory,
  STATUS_LABEL, STATUS_CLASS, CATEGORY_EMOJI,
} from '../../../src/api/tickets'

const STATUS_FILTERS: Array<{ key: TicketStatus | 'ALL'; label: string }> = [
  { key: 'ALL',        label: 'Все'       },
  { key: 'OPEN',       label: 'Открытые'  },
  { key: 'IN_PROGRESS',label: 'В работе'  },
  { key: 'RESOLVED',   label: 'Решены'    },
  { key: 'CLOSED',     label: 'Закрыты'   },
]

function StatusBadge({ status }: { status: TicketStatus }) {
  const cls = STATUS_CLASS[status]
  return (
    <View className={`rounded-full px-2.5 py-0.5 ${cls.bg}`}>
      <Text className={`text-xs font-medium ${cls.text}`}>{STATUS_LABEL[status]}</Text>
    </View>
  )
}

function TicketCard({ ticket, onPress }: { ticket: Ticket; onPress: () => void }) {
  const date = new Date(ticket.createdAt).toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'short',
  })

  return (
    <TouchableOpacity
      className="bg-white rounded-2xl p-4 mx-4 mb-3 shadow-sm"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row items-start justify-between gap-2 mb-2">
        <View className="flex-row items-center gap-2 flex-1">
          <Text className="text-xl">{CATEGORY_EMOJI[ticket.category]}</Text>
          <Text className="text-sm font-semibold text-slate-900 flex-1" numberOfLines={2}>
            {ticket.title}
          </Text>
        </View>
        <StatusBadge status={ticket.status} />
      </View>

      <Text className="text-xs text-slate-500" numberOfLines={2}>
        {ticket.description}
      </Text>

      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-slate-50">
        <Text className="text-xs text-slate-400">
          #{ticket.ticketNumber} · {date}
        </Text>
        {ticket._count.comments > 0 && (
          <View className="flex-row items-center gap-1">
            <Text className="text-xs text-slate-400">💬 {ticket._count.comments}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

export default function TicketsScreen() {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState<TicketStatus | 'ALL'>('ALL')

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['tickets', activeFilter],
    queryFn:  () => ticketsApi.getAll(
      activeFilter !== 'ALL' ? { status: activeFilter } : undefined
    ),
  })

  const tickets = data?.data ?? []

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-slate-100">
        <Text className="text-xl font-bold text-slate-900">Мои заявки</Text>
        <TouchableOpacity
          className="w-9 h-9 rounded-full bg-primary-600 items-center justify-center"
          onPress={() => router.push('/(app)/tickets/create')}
        >
          <Text className="text-white text-xl leading-none pb-0.5">+</Text>
        </TouchableOpacity>
      </View>

      {/* ── Filter chips ─────────────────────────────────────────────── */}
      <View className="bg-white border-b border-slate-100">
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={(i) => i.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={`px-4 py-1.5 rounded-full border ${
                activeFilter === item.key
                  ? 'bg-primary-600 border-primary-600'
                  : 'bg-white border-slate-200'
              }`}
              onPress={() => setActiveFilter(item.key)}
            >
              <Text className={`text-sm font-medium ${
                activeFilter === item.key ? 'text-white' : 'text-slate-600'
              }`}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* ── List ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#2563EB" size="large" />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TicketCard
              ticket={item}
              onPress={() => router.push(`/(app)/tickets/${item.id}`)}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563EB" />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-4xl mb-3">📋</Text>
              <Text className="text-base font-semibold text-slate-700">Заявок пока нет</Text>
              <Text className="text-sm text-slate-400 mt-1 text-center px-8">
                Нажмите + чтобы создать первую заявку
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 24, flexGrow: 1 }}
        />
      )}
    </SafeAreaView>
  )
}
