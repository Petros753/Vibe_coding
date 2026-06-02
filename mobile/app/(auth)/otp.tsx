import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, SafeAreaView, Pressable, ScrollView,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import auth from '@react-native-firebase/auth'
import { authApi } from '../../src/api/auth'
import { useAuthStore } from '../../src/store/auth.store'
import { firebaseConfirmation } from '../../src/lib/firebase-confirmation'

const CODE_LENGTH    = 6
const RESEND_SECONDS = 60

function maskPhone(phone: string) {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 11) return phone
  return `+7 (${digits.slice(1,4)}) ${digits.slice(4,7)}-**-**`
}

export default function OtpScreen() {
  const router    = useRouter()
  const { phone } = useLocalSearchParams<{ phone: string }>()
  const setTokens = useAuthStore((s) => s.setTokens)

  const [code,      setCode]      = useState('')
  const [error,     setError]     = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [countdown, setCountdown] = useState(RESEND_SECONDS)
  const inputRef = useRef<TextInput>(null)

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
      const confirmation = firebaseConfirmation.get()

      if (!confirmation) {
        setDebugInfo('ОШИБКА: confirmation отсутствует в хранилище')
        setError('Сессия истекла, запросите код заново')
        setLoading(false)
        return
      }

      setDebugInfo('Шаг 1: проверка кода ' + clean + '...')
      try {
        const result = await confirmation.confirm(clean)
        setDebugInfo('Шаг 2: получаем idToken...')
        const idToken = await result?.user.getIdToken()
        if (!idToken) {
          setDebugInfo('ОШИБКА: idToken пустой')
          throw new Error('No ID token')
        }
        setDebugInfo('Шаг 3: idToken получен (' + idToken.length + ' символов), отправка на бэкенд...')
        const data = await authApi.firebaseLogin(idToken)
        setDebugInfo('Шаг 4: JWT получен, переход в app')
        firebaseConfirmation.clear()
        setTokens(data.accessToken, data.refreshToken)
        router.replace('/(app)/')
      } catch (err: any) {
        const errorDetails = {
          code:    err?.code        || 'no code',
          message: err?.message     || 'no message',
          name:    err?.name        || 'no name',
          response: err?.response?.data || 'no response data',
          status:  err?.response?.status || 'no status',
        }
        setDebugInfo(JSON.stringify(errorDetails, null, 2))
        setError('Ошибка проверки кода')
        setCode('')
      } finally {
        setLoading(false)
      }
    }
  }, [])

  async function handleResend() {
    setLoading(true)
    setError(null)
    try {
      const newConfirmation = await auth().signInWithPhoneNumber(phone ?? '')
      firebaseConfirmation.set(newConfirmation)
      setCountdown(RESEND_SECONDS)
      setCode('')
    } catch {
      setError('Не удалось отправить код.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 px-6">

          <Pressable
            className="mt-4 mb-8 w-10 h-10 items-center justify-center rounded-full bg-slate-100"
            onPress={() => router.back()}
          >
            <Text className="text-xl text-slate-700">←</Text>
          </Pressable>

          <Text className="text-2xl font-bold text-slate-900 mb-2">
            Код подтверждения
          </Text>
          <Text className="text-sm text-slate-500 mb-8">
            Мы отправили SMS на номер{'\n'}
            <Text className="font-semibold text-slate-700">{maskPhone(phone ?? '')}</Text>
          </Text>

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

          <Pressable
            className="flex-row gap-2 mb-6"
            onPress={() => inputRef.current?.focus()}
          >
            {Array.from({ length: CODE_LENGTH }).map((_, i) => {
              const isActive = code.length === i && !loading
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
                  {loading && i === code.length - 1 ? (
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

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <Text className="text-sm text-red-600">{error}</Text>
            </View>
          )}

          {debugInfo && (
            <View className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 mb-4">
              <Text className="text-xs font-bold text-yellow-900 mb-2">DEBUG:</Text>
              <Text className="text-xs text-yellow-900" style={{ fontFamily: 'monospace' }}>
                {debugInfo}
              </Text>
            </View>
          )}

          <View className="items-center mt-2">
            {countdown > 0 ? (
              <Text className="text-sm text-slate-400">
                Отправить повторно через{' '}
                <Text className="font-semibold text-slate-600">{countdown}с</Text>
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={loading}>
                {loading ? (
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
      </ScrollView>
    </SafeAreaView>
  )
}
