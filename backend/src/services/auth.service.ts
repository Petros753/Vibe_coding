/**
 * services/auth.service.ts — вся бизнес-логика авторизации
 *
 * Флоу:
 *   sendOtp    → генерируем код, сохраняем в User.otpCode, отправляем SMS
 *   verifyOtp  → проверяем код + TTL, создаём Session, возвращаем токены
 *   refresh    → ротация refresh token (старая Session → новая Session)
 *   logout     → помечаем Session.isRevoked = true
 */

import { prisma } from '../lib/prisma.ts'
import { generateOtp, sendOtp } from '../lib/sms.ts'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshExpiresAt,
} from '../lib/jwt.ts'

const OTP_TTL_MS      = 5 * 60 * 1000  // 5 минут
const OTP_MAX_ATTEMPTS = 3

// ── Типы ответов ────────────────────────────────────────────────────────────

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

// ── sendOtp ─────────────────────────────────────────────────────────────────

export async function sendOtpService(phone: string): Promise<void> {
  // Находим или создаём пользователя (первый вход = автоматическая регистрация)
  const user = await prisma.user.upsert({
    where: { phone },
    update: {},
    create: { phone },
  })

  // Блокируем если превышен лимит попыток и TTL ещё не истёк
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
      otpAttempts:  0,          // сбрасываем при новой отправке
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

  // Слишком много попыток
  if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
    throw new OtpTooManyAttemptsError()
  }

  // TTL истёк
  if (user.otpExpiresAt < new Date()) {
    throw new OtpInvalidError('OTP истёк')
  }

  // Неверный код — инкрементируем счётчик
  if (user.otpCode !== code) {
    await prisma.user.update({
      where: { id: user.id },
      data: { otpAttempts: { increment: 1 } },
    })
    throw new OtpInvalidError()
  }

  // Код верный — очищаем OTP
  await prisma.user.update({
    where: { id: user.id },
    data: { otpCode: null, otpExpiresAt: null, otpAttempts: 0 },
  })

  return createSession(user, meta)
}

// ── refresh ──────────────────────────────────────────────────────────────────

export async function refreshService(refreshToken: string): Promise<AuthTokens> {
  // 1. Сначала проверяем подпись JWT (не истёк ли)
  try {
    verifyRefreshToken(refreshToken)
  } catch {
    throw new UnauthorizedError('Невалидный refresh token')
  }

  // 2. Ищем сессию в БД по токену
  const session = await prisma.session.findUnique({
    where: { refreshToken },
    include: { user: true },
  })

  if (!session || session.isRevoked || session.expiresAt < new Date()) {
    throw new UnauthorizedError('Сессия недействительна или истекла')
  }

  // 3. Ротация: отзываем старую сессию и создаём новую в одной транзакции
  const u = session.user
  const jwtBase = {
    sub:            u.id,
    organizationId: u.organizationId,
    role:           u.role,
  }

  // Создаём новую сессию со временным плейсхолдером
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

  // 4. Подписываем токены теперь, когда знаем newSession.id
  const accessToken      = signAccessToken({ ...jwtBase, sessionId: newSession.id })
  const newRefreshToken  = signRefreshToken({ ...jwtBase, sessionId: newSession.id })

  await prisma.session.update({
    where: { id: newSession.id },
    data:  { refreshToken: newRefreshToken },
  })

  return { accessToken, refreshToken: newRefreshToken }
}

// ── logout ────────────────────────────────────────────────────────────────────

export async function logoutService(sessionId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId },
    data: { isRevoked: true },
  })
}

// ── Внутренние хелперы ────────────────────────────────────────────────────────

async function createSession(
  user: { id: string; organizationId: string | null; role: string; phone: string; firstName: string | null; lastName: string | null },
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<AuthResult> {
  // Создаём сессию с временным плейсхолдером, потом обновляем с реальным refreshToken
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

  // Теперь знаем session.id — подписываем токены
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
