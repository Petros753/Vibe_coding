import { z } from 'zod'

// Типы чат-комнат:
//   complex_{complexId}        — общедомовой чат ЖК
//   entrance_{entranceId}      — чат подъезда
//   apartment_{apartmentId}_uk — личный чат квартиры с УК
export const chatRoomIdSchema = z.string().regex(
  /^(complex|entrance|apartment)_[a-z0-9]+(_uk)?$/,
  'Неверный формат chatRoomId',
)

export const sendMessageSchema = z.object({
  chatRoomId: chatRoomIdSchema,
  text:       z.string().min(1).max(4000).optional(),
  mediaUrls:  z.array(z.string().url()).max(5).default([]),
}).refine(d => d.text || d.mediaUrls.length > 0, {
  message: 'Сообщение должно содержать текст или медиафайл',
})

export type SendMessageDto = z.infer<typeof sendMessageSchema>
