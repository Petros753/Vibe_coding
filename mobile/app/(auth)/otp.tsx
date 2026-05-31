import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, SafeAreaView, Pressable,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth'
import { authApi } from '../../src/api/auth'
import { useAuthStore } from '../../src/store/auth.store'

const CODE_LENGTH    = 6  // Firebase использует 6-значный код
const RESEND_SECONDS = 60

function maskPhone(phone: string) {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 11) return phone
  return `+7 (${digits.slice(1,4)}) ${digits.slice(4,7)}-**-**`
}

export default function OtpScreen() {
  const router    = useRouter()
  const { phone, confirmationId } = useLocalSearchParams<{ phone: string; confirmationId: string }>()
  const setTokens = useAuthStore((s) => s.setTokens)

  const [code,         setCode]         = useState('')
  const [error,        setError]        = useState<string | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [countdown,    setCountdown]    = useState(RESEND_SECONDS)
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (confirmationId) {
      try {
        setConfirmation(JSON.parse(confirmationId))
      } catch {
        console.warn('[OTP] Failed to parse confirmationId')
      }
    }
  }, [])

  // Countdown таймер
  useEffect(() => {
    if (countdown <= 0) return
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  const handleCodeChange = useCallback(async (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, CODE_LENGTH)
    setCode(clean)
    setError(null)

    if (clean.length === CODE_LENGTH) {
      setLoading(true)
      try {
        // 1. Проверяем код через Firebase
        const result  = await confirmation?.confirm(clean)
        // 2. Получаем Firebase ID токен
        const idToken = await result?.user.getIdToken()
        if (!idToken) throw new Error('No ID token')
        // 3. Обмениваем на наш JWT
        const data = await authApi.firebaseLogin(idToken)
        setTokens(data.accessToken, data.refreshToken)
        router.replace('/(app)/')
      } catch (err: any) {
        console.error('[OTP verify]', err)
        if (err?.code === 'auth/invalid-verification-code') {
          setError('Неверный код. Попробуйте снова.')
        } else if (err?.code === 'auth/code-expired') {
          setError('Код истёк. Запросите новый.')
        } else {
          setError('Ошибка проверки кода. Попробуйте снова.')
        }
        setCode('')
      } finally {
        setLoading(false)
      }
    }
  }, [confirmation])

  async function handleResend() {
    setLoading(true)
    setError(null)
    try {
      const newConfirmation = await auth().signInWithPhoneNumber(phone ?? '')
      setConfirmation(newConfirmation)
      setCountdown(RESEND_SECONDS)
      setCode('')
    } catch {
      setError('Не удалось отправить код.')
    } finally {
      setLoading(false)
    }
  }

  const isLoading = loading

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 px-6">

        {/* Кнопка назад */}
        <Pressable
          className="mt-4 mb-8 w-10 h-10 items-center justify-center rounded-full bg-slate-100"
          onPress={() => router.back()}
        >
          <Text className="text-xl text-slate-700">←</Text>
        </Pressable>

        {/* Заголовок */}
        <Text className="text-2xl font-bold text-slate-900 mb-2">
          Код подтверждения
        </Text>
        <Text className="text-sm text-slate-500 mb-8">
          Мы отправили SMS на номер{'\n'}
          <Text className="font-semibold text-slate-700">{maskPhone(phone ?? '')}</Text>
        </Text>

        {/* Скрытый input */}
        <TextInput
          ref={inputRef}
          className="absolute opacity-0 w-0 h-0"
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          value={code}
          onChangeText={handleCodeChange}
          autoFocus
          caretHidden
        />

        {/* 6 ячеек кода */}
        <Pressable
          className="flex-row gap-2 mb-6"
          onPress={() => inputRef.current?.focus()}
        >
          {Array.from({ length: CODE_LENGTH }).map((_, i) => {
            const isActive = code.length === i && !isLoading
            const isFilled = i < code.length
            const hasError = !!error

            return (
              <View
                key={i}
                className={`
                  flex-1 h-14 rounded-xl items-center justify-center border-2
                  ${hasError  ? 'border-red-400 bg-red-50' :
                    isActive  ? 'border-primary-600 bg-primary-50' :
                    isFilled  ? 'border-primary-300 bg-white' :
                                'border-slate-200 bg-white'}
                `}
              >
                {isLoading && i === code.length - 1 ? (
                  <ActivityIndicator color="#2563EB" size="small" />
                ) : (
                  <Text className={`text-xl font-bold ${isFilled ? 'text-slate-900' : 'text-slate-300'}`}>
                    {isFilled ? '•' : '—'}
                  </Text>
                )}
              </View>
            )
          })}
        </Pressable>

        {/* Ошибка */}
        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <Text className="text-sm text-red-600">{error}</Text>
          </View>
        )}

        {/* Повторная отправка */}
        <View className="items-center mt-2">
          {countdown > 0 ? (
            <Text className="text-sm text-slate-400">
              Отправить повторно через{' '}
              <Text className="font-semibold text-slate-600">{countdown}с</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#2563EB" size="small" />
              ) : (
                <Text className="text-sm font-semibold text-primary-600">
                  Отправить повторно
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

      </View>
    </SafeAreaView>
  )
}
