/**
 * lib/jwt.ts — работа с JWT токенами
 *
 * Access token:  JWT, TTL 15 минут
 * Refresh token: JWT, TTL 30 дней, хранится в БД (Session)
 */

import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'

export interface JwtPayload {
  sub: string            // user.id
  organizationId: string | null
  role: Role
  sessionId: string
  iat?: number
  exp?: number
}

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET!
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!

export const ACCESS_TTL_SEC  = 15 * 60          // 15 минут
export const REFRESH_TTL_SEC = 30 * 24 * 60 * 60 // 30 дней

// ── Генерация ──────────────────────────────────────────────────────────────

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL_SEC })
}

export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL_SEC })
}

// ── Верификация ────────────────────────────────────────────────────────────

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload
}

// ── Вспомогательное ───────────────────────────────────────────────────────

export function refreshExpiresAt(): Date {
  return new Date(Date.now() + REFRESH_TTL_SEC * 1000)
}
