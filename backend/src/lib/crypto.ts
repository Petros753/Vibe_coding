/**
 * lib/crypto.ts — AES-256-CBC шифрование RTSP URL камер
 *
 * RTSP URL никогда не отдаётся клиенту в открытом виде.
 * Хранится в БД в зашифрованном виде, отдаётся только WebRTC stream URL.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-cbc'
const KEY_HEX   = process.env.CAMERA_STREAM_SECRET ?? 'moidom_stream_secret_dev_changeme'

// Ключ всегда 32 байта (256 бит) — дополняем или обрезаем
const KEY = Buffer.from(KEY_HEX.padEnd(32, '0').slice(0, 32))

export function encryptRtspUrl(plaintext: string): string {
  const iv         = randomBytes(16)
  const cipher     = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  // Формат: iv_hex:encrypted_hex
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptRtspUrl(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(':')
  const iv              = Buffer.from(ivHex, 'hex')
  const enc             = Buffer.from(encHex, 'hex')
  const decipher        = createDecipheriv(ALGORITHM, KEY, iv)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
