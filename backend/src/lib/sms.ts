/**
 * lib/sms.ts — отправка OTP через SMS.ru
 *
 * В DEV-режиме (NODE_ENV !== 'production') SMS не отправляется,
 * код печатается в консоль — удобно для разработки без реального API key.
 */

export function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export async function sendOtp(phone: string, code: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] SMS OTP для ${phone}: ${code}`)
    return
  }

  const apiKey = process.env.SMSRU_API_KEY
  if (!apiKey) throw new Error('SMSRU_API_KEY не задан')

  const params = new URLSearchParams({
    api_id: apiKey,
    to: phone,
    msg: `Ваш код МойДом: ${code}. Никому не сообщайте.`,
    json: '1',
  })

  const res = await fetch('https://sms.ru/sms/send', {
    method: 'POST',
    body: params,
  })

  const data = (await res.json()) as { status: string; status_text?: string }
  if (data.status !== 'OK') {
    throw new Error(`SMS.ru ошибка: ${data.status_text ?? data.status}`)
  }
}
