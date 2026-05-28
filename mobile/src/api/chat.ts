import { api } from './client'

export interface ChatRoom {
  id:   string
  name: string
  type: 'complex' | 'entrance' | 'apartment_uk'
}

export interface ChatMessage {
  id:         string
  chatRoomId: string
  senderId:   string
  senderName: string
  senderRole: string
  text:       string | null
  mediaUrls:  string[]
  createdAt:  string
  own?:       boolean
}

export interface WsIncomingMessage {
  type:       'connected' | 'joined' | 'message' | 'pong' | 'error'
  chatRoomId?: string
  userId?:     string
  senderName?: string
  id?:         string
  senderId?:   string
  senderRole?: string
  text?:       string | null
  mediaUrls?:  string[]
  createdAt?:  string
  own?:        boolean
  message?:    string
}

export const chatApi = {
  getRooms: () =>
    api.get<{ data: ChatRoom[] }>('/chat/rooms').then((r) => r.data.data),

  getHistory: (roomId: string, params?: { limit?: number; before?: string }) =>
    api
      .get<{ data: ChatMessage[] }>(`/chat/${roomId}/messages`, { params })
      .then((r) => r.data.data),
}
