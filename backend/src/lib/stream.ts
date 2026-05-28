/**
 * lib/stream.ts — подпись WebRTC stream токенов для камер
 *
 * Защищает прямой доступ к MediaMTX.
 * Токен включает cameraId и TTL — MediaMTX проверяет его через хук авторизации.
 */

import jwt from 'jsonwebtoken'

const STREAM_SECRET = process.env.CAMERA_STREAM_SECRET ?? 'moidom_stream_secret_dev_changeme'
const MEDIA_SERVER  = process.env.MEDIA_SERVER_URL      ?? 'https://media.moidom.ru'
const STREAM_TTL    = 4 * 60 * 60 // 4 часа

export function signStreamToken(cameraId: string): string {
  return jwt.sign({ cameraId }, STREAM_SECRET, { expiresIn: STREAM_TTL })
}

export function getStreamUrl(cameraId: string): string {
  const token = signStreamToken(cameraId)
  return `${MEDIA_SERVER}/${cameraId}/whep?token=${token}`
}
