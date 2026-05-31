/**
 * services/auth.service.ts — вся бизнес-логика авторизации
 */

import { prisma } from '../lib/prisma.ts'
import { generateOtp, sendOtp } from '../lib/sms.ts'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshExpiresAt,
} from '../lib/jwt.ts'

const OTP_TTL_MS       = 5 * 60 * 1000  // 5 минут
const OTP_MAX_ATTEMPTS = 3

// ── Типы ответов ─────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthResult extends AuthTokens {
  user: {
    id: string
    phone: string
    firstName: string | null
    lastName: string | null
    role: string
    organizationId: string | null
  }
}

// ── sendOtp ──────────────────────────────────────────────────────────────────

export async function sendOtpService(phone: string): Promise<void> {
  const user = await prisma.user.upsert({
    where: { phone },
    update: {},
    create: { phone },
  })

  if (
    user.otpAttempts >= OTP_MAX_ATTEMPTS &&
    user.otpExpiresAt &&
    user.otpExpiresAt > new Date()
  ) {
    throw new OtpTooManyAttemptsError()
  }

  const code      = generateOtp()
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      otpCode:      code,
      otpExpiresAt: expiresAt,
      otpAttempts:  0,
    },
  })

  await sendOtp(phone, code)
}

// ── verifyOtp ────────────────────────────────────────────────────────────────

export async function verifyOtpService(
  phone: string,
  code: string,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { phone } })

  if (!user || !user.otpCode || !user.otpExpiresAt) {
    throw new OtpInvalidError()
  }

  if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
    throw new OtpTooManyAttemptsError()
  }

  if (user.otpExpiresAt < new Date()) {
    throw new OtpInvalidError('OTP истёк')
  }

  if (user.otpCode !== code) {
    await prisma.user.update({
      where: { id: user.id },
      data: { otpAttempts: { increment: 1 } },
    })
    throw new OtpInvalidError()
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { otpCode: null, otpExpiresAt: null, otpAttempts: 0 },
  })

  return createSession(user, meta)
}

// ── refresh ──────────────────────────────────────────────────────────────────

export async function refreshService(refreshToken: string): Promise<AuthTokens> {
  try {
    verifyRefreshToken(refreshToken)
  } catch {
    throw new UnauthorizedError('Невалидный refresh token')
  }

  const session = await prisma.session.findUnique({
    where: { refreshToken },
    include: { user: true },
  })

  if (!session || session.isRevoked || session.expiresAt < new Date()) {
    throw new UnauthorizedError('Сессия недействительна или истекла')
  }

  const u = session.user
  const jwtBase = {
    sub:            u.id,
    organizationId: u.organizationId,
    role:           u.role,
  }

  const placeholder = `pending_${crypto.randomUUID()}`
  const [, newSession] = await prisma.$transaction([
    prisma.session.update({ where: { id: session.id }, data: { isRevoked: true } }),
    prisma.session.create({
      data: {
        userId:       u.id,
        refreshToken: placeholder,
        expiresAt:    refreshExpiresAt(),
        userAgent:    session.userAgent,
        ipAddress:    session.ipAddress,
      },
    }),
  ])

  const accessToken     = signAccessToken({ ...jwtBase, sessionId: newSession.id })
  const newRefreshToken = signRefreshToken({ ...jwtBase, sessionId: newSession.id })

  await prisma.session.update({
    where: { id: newSession.id },
    data:  { refreshToken: newRefreshToken },
  })

  return { accessToken, refreshToken: newRefreshToken }
}

// ── logout ───────────────────────────────────────────────────────────────────

export async function logoutService(sessionId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId },
    data: { isRevoked: true },
  })
}

// ── createSession (экспортируем для /auth/firebase) ──────────────────────────

export async function createSession(
  user: { id: string; organizationId: string | null; role: string; phone: string; firstName: string | null; lastName: string | null },
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<AuthResult> {
  const placeholder = `pending_${crypto.randomUUID()}`
  const session = await prisma.session.create({
    data: {
      userId:       user.id,
      refreshToken: placeholder,
      expiresAt:    refreshExpiresAt(),
      userAgent:    meta?.userAgent,
      ipAddress:    meta?.ipAddress,
    },
  })

  const jwtBase = {
    sub:            user.id,
    organizationId: user.organizationId,
    role:           user.role as never,
    sessionId:      session.id,
  }

  const accessToken  = signAccessToken(jwtBase)
  const refreshToken = signRefreshToken(jwtBase)

  await prisma.session.update({
    where: { id: session.id },
    data: { refreshToken },
  })

  return {
    accessToken,
    refreshToken,
    user: {
      id:             user.id,
      phone:          user.phone,
      firstName:      user.firstName,
      lastName:       user.lastName,
      role:           user.role,
      organizationId: user.organizationId,
    },
  }
}

// ── Кастомные ошибки ─────────────────────────────────────────────────────────

export class OtpInvalidError extends Error {
  constructor(msg = 'Неверный или истёкший OTP код') {
    super(msg)
    this.name = 'OtpInvalidError'
  }
}

export class OtpTooManyAttemptsError extends Error {
  constructor() {
    super('Превышен лимит попыток. Запросите новый код.')
    this.name = 'OtpTooManyAttemptsError'
  }
}

export class UnauthorizedError extends Error {
  constructor(msg = 'Не авторизован') {
    super(msg)
    this.name = 'UnauthorizedError'
  }
}