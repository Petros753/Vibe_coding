import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { chatApi, ChatMessage, WsIncomingMessage } from '../../../src/api/chat'
import { useAuthStore } from '../../../src/store/auth.store'

const STAFF_ROLES = new Set(['ORG_ADMIN', 'ORG_MANAGER', 'SUPER_ADMIN'])

function MessageBubble({ msg, currentUserId }: { msg: ChatMessage; currentUserId?: string }) {
  const isOwn    = msg.own || msg.senderId === currentUserId
  const isStaff  = STAFF_ROLES.has(msg.senderRole)
  const time     = new Date(msg.createdAt).toLocaleTimeString('ru-RU', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <View className={`mb-2 px-3 ${isOwn ? 'items-end' : 'items-start'}`}>
      {!isOwn && (
        <Text className={`text-xs mb-1 font-semibold ${isStaff ? 'text-primary-600' : 'text-slate-500'}`}>
          {isStaff ? `🏢 УК · ${msg.senderName}` : msg.senderName}
        </Text>
      )}
      <View
        className={`max-w-[82%] rounded-2xl px-4 py-2.5 ${
          isOwn
            ? 'bg-primary-600 rounded-tr-sm'
            : isStaff
              ? 'bg-blue-100 rounded-tl-sm'
              : 'bg-white rounded-tl-sm shadow-sm'
        }`}
      >
        <Text className={`text-sm leading-5 ${isOwn ? 'text-white' : 'text-slate-800'}`}>
          {msg.text}
        </Text>
      </View>
      <Text className="text-xs text-slate-400 mt-0.5 mx-0.5">{time}</Text>
    </View>
  )
}

export default function ChatRoomScreen() {
  const { roomId: rawRoomId } = useLocalSearchParams<{ roomId: string }>()
  const roomId  = decodeURIComponent(rawRoomId ?? '')
  const router  = useRouter()
  const token   = useAuthStore((s) => s.accessToken)

  const [text,        setText]        = useState('')
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([])
  const [wsStatus,    setWsStatus]    = useState<'connecting' | 'open' | 'error'>('connecting')
  const [joined,      setJoined]      = useState(false)
  const wsRef   = useRef<WebSocket | null>(null)
  const listRef = useRef<FlatList>(null)

  // ── REST history ─────────────────────────────────────────────────────────
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['chat-history', roomId],
    queryFn:  () => chatApi.getHistory(roomId, { limit: 50 }),
    enabled:  !!roomId,
  })

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !roomId) return

    const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000')
      .replace(/^https/, 'wss')
      .replace(/^http/, 'ws')

    const ws = new WebSocket(`${baseUrl}/chat/ws?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      setWsStatus('open')
      ws.send(JSON.stringify({ type: 'join', chatRoomId: roomId }))
    }

    ws.onmessage = (event) => {
      let msg: WsIncomingMessage
      try { msg = JSON.parse(event.data as string) } catch { return }

      if (msg.type === 'joined') {
        setJoined(true)
      } else if (msg.type === 'message' && msg.id && msg.senderId) {
        const newMsg: ChatMessage = {
          id:         msg.id,
          chatRoomId: msg.chatRoomId ?? roomId,
          senderId:   msg.senderId,
          senderName: msg.senderName ?? '',
          senderRole: msg.senderRole ?? 'RESIDENT',
          text:       msg.text ?? null,
          mediaUrls:  msg.mediaUrls ?? [],
          createdAt:  msg.createdAt ?? new Date().toISOString(),
          own:        msg.own,
        }
        setLiveMessages((prev) => {
          // Deduplicate by id (own messages come back from WS as confirmation)
          if (prev.some((m) => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
      } else if ((msg.type as string) === 'ping') {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }

    ws.onerror  = () => setWsStatus('error')
    ws.onclose  = () => setWsStatus('connecting')

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [roomId, token])

  // ── Merge history + live messages ─────────────────────────────────────────
  const historyIds = new Set(liveMessages.map((m) => m.id))
  const allMessages: ChatMessage[] = [
    ...history.filter((m) => !historyIds.has(m.id)),
    ...liveMessages,
  ]

  const sendMessage = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    wsRef.current.send(JSON.stringify({
      type:       'message',
      chatRoomId: roomId,
      text:       trimmed,
    }))
    setText('')
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }, [text, roomId])

  // Room name from id
  const roomName = roomId.startsWith('complex_')
    ? 'Общий чат ЖК'
    : roomId.startsWith('entrance_')
      ? 'Чат подъезда'
      : 'Чат с УК'

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <View className="flex-row items-center gap-3 px-4 py-3 bg-white border-b border-slate-100">
          <TouchableOpacity
            className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center"
            onPress={() => router.back()}
          >
            <Text className="text-lg text-slate-700">‹</Text>
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-base font-bold text-slate-900">{roomName}</Text>
            <View className="flex-row items-center gap-1">
              <View className={`w-1.5 h-1.5 rounded-full ${
                wsStatus === 'open' ? 'bg-green-500' : wsStatus === 'error' ? 'bg-red-500' : 'bg-amber-400'
              }`} />
              <Text className="text-xs text-slate-400">
                {wsStatus === 'open' && joined ? 'В сети' : wsStatus === 'error' ? 'Ошибка подключения' : 'Подключение...'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Messages ─────────────────────────────────────────────── */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#2563EB" size="large" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={allMessages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <MessageBubble msg={item} currentUserId={undefined} />
            )}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-16">
                <Text className="text-3xl mb-2">💬</Text>
                <Text className="text-sm text-slate-400">Сообщений пока нет</Text>
                <Text className="text-xs text-slate-300 mt-1">Будьте первым!</Text>
              </View>
            }
          />
        )}

        {/* ── Input ────────────────────────────────────────────────── */}
        <View className="border-t border-slate-100 bg-white px-3 py-2">
          <View className="flex-row items-end gap-2">
            <TextInput
              className="flex-1 bg-slate-50 rounded-2xl px-4 py-3 text-sm text-slate-900 min-h-[44px]"
              placeholder={joined ? 'Написать сообщение...' : 'Подключение...'}
              placeholderTextColor="#94A3B8"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
              editable={joined}
              style={{ maxHeight: 100 }}
            />
            <TouchableOpacity
              className={`w-10 h-10 rounded-full items-center justify-center ${
                text.trim() && joined ? 'bg-primary-600' : 'bg-slate-200'
              }`}
              onPress={sendMessage}
              disabled={!text.trim() || !joined}
            >
              <Text className={`text-base ${text.trim() && joined ? 'text-white' : 'text-slate-400'}`}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
