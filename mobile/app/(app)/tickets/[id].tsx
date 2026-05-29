import { useState, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ticketsApi, TicketStatus, TicketCategory, TicketComment,
  STATUS_LABEL, STATUS_CLASS, CATEGORY_LABEL, CATEGORY_EMOJI,
} from '../../../src/api/tickets'

function StatusBadge({ status }: { status: TicketStatus }) {
  const cls = STATUS_CLASS[status]
  return (
    <View className={`rounded-full px-3 py-1 ${cls.bg}`}>
      <Text className={`text-xs font-semibold ${cls.text}`}>{STATUS_LABEL[status]}</Text>
    </View>
  )
}

function CommentBubble({ comment }: { comment: TicketComment }) {
  const name = [comment.author.firstName, comment.author.lastName].filter((s): s is string => Boolean(s)).join(' ') || 'Пользователь'
  const isStaff = ['ORG_ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN'].includes(comment.author.role ?? '')
  const date = new Date(comment.createdAt).toLocaleString('ru-RU', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <View className={`mb-3 ${isStaff ? 'items-start' : 'items-end'}`}>
      <View className={`max-w-[85%] rounded-2xl px-4 py-3 ${
        isStaff ? 'bg-slate-100 rounded-tl-sm' : 'bg-primary-600 rounded-tr-sm'
      }`}>
        {isStaff && (
          <Text className="text-xs font-semibold text-primary-600 mb-1">
            УК · {name}
          </Text>
        )}
        <Text className={`text-sm leading-5 ${isStaff ? 'text-slate-800' : 'text-white'}`}>
          {comment.text}
        </Text>
        {comment.mediaUrls.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 mt-2">
            {comment.mediaUrls.map((url, i) => (
              <Image
                key={i}
                source={{ uri: url }}
                className="w-20 h-20 rounded-lg"
                resizeMode="cover"
              />
            ))}
          </View>
        )}
      </View>
      <Text className="text-xs text-slate-400 mt-1 mx-1">{date}</Text>
    </View>
  )
}

export default function TicketDetailScreen() {
  const { id }        = useLocalSearchParams<{ id: string }>()
  const router        = useRouter()
  const queryClient   = useQueryClient()
  const scrollRef     = useRef<ScrollView>(null)
  const [comment, setComment] = useState('')

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn:  () => ticketsApi.getById(id),
    enabled:  !!id,
  })

  const addComment = useMutation({
    mutationFn: (text: string) => ticketsApi.addComment(id, { text }),
    onSuccess: () => {
      setComment('')
      queryClient.invalidateQueries({ queryKey: ['ticket', id] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)
    },
  })

  if (isLoading || !ticket) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center" edges={['top']}>
        <ActivityIndicator color="#2563EB" size="large" />
      </SafeAreaView>
    )
  }

  const createdDate = new Date(ticket.createdAt).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {/* ── Custom header ──────────────────────────────────────────── */}
        <View className="flex-row items-center gap-3 px-4 py-3 bg-white border-b border-slate-100">
          <TouchableOpacity
            className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center"
            onPress={() => router.back()}
          >
            <Text className="text-lg text-slate-700">‹</Text>
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
              Заявка #{ticket.ticketNumber}
            </Text>
            <Text className="text-xs text-slate-400">{createdDate}</Text>
          </View>
          <StatusBadge status={ticket.status} />
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Ticket info card ─────────────────────────────────────── */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <View className="flex-row items-center gap-2 mb-3">
              <Text className="text-2xl">{CATEGORY_EMOJI[ticket.category]}</Text>
              <View>
                <Text className="text-xs text-slate-400">{CATEGORY_LABEL[ticket.category]}</Text>
                <Text className="text-base font-bold text-slate-900">{ticket.title}</Text>
              </View>
            </View>

            <Text className="text-sm text-slate-600 leading-5">{ticket.description}</Text>

            {ticket.mediaUrls.length > 0 && (
              <View className="flex-row flex-wrap gap-2 mt-3">
                {ticket.mediaUrls.map((url, i) => (
                  <Image
                    key={i}
                    source={{ uri: url }}
                    className="w-24 h-24 rounded-xl"
                    resizeMode="cover"
                  />
                ))}
              </View>
            )}
          </View>

          {/* ── Comments ─────────────────────────────────────────────── */}
          {ticket.comments.length > 0 ? (
            <View className="mb-2">
              <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Комментарии · {ticket.comments.length}
              </Text>
              {ticket.comments.map((c) => (
                <CommentBubble key={c.id} comment={c} />
              ))}
            </View>
          ) : (
            <View className="items-center py-6">
              <Text className="text-2xl mb-1">💬</Text>
              <Text className="text-sm text-slate-400">Комментариев пока нет</Text>
            </View>
          )}
        </ScrollView>

        {/* ── Comment input ─────────────────────────────────────────── */}
        {ticket.status !== 'CLOSED' && (
          <View className="border-t border-slate-100 bg-white px-3 py-2">
            <View className="flex-row items-end gap-2">
              <TextInput
                className="flex-1 bg-slate-50 rounded-2xl px-4 py-3 text-sm text-slate-900 min-h-[44px]"
                placeholder="Написать комментарий..."
                placeholderTextColor="#94A3B8"
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={2000}
                style={{ maxHeight: 100 }}
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
              />
              <TouchableOpacity
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  comment.trim() && !addComment.isPending
                    ? 'bg-primary-600'
                    : 'bg-slate-200'
                }`}
                onPress={() => comment.trim() && addComment.mutate(comment.trim())}
                disabled={!comment.trim() || addComment.isPending}
              >
                {addComment.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white text-base">↑</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
