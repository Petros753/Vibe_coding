import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, SafeAreaView, Pressable,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../src/api/auth'
import { useAuthStore } from '../../src/store/auth.store'

const CODE_LENGTH = 4
const RESEND_SECONDS = 60

function maskPhone(phone: string) {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 11) return phone
  return `+7 (${digits.slice(1,4)}) ${digits.slice(4,7)}-**-**`
}

export default function OtpScreen() {
  const router = useRouter()
  const { phone } = useLocalSearchParams<{ phone: string }>()
  const setTokens = useAuthStore((s) => s.setTokens)

  const [code,        setCode]        = useState('')
  const [error,       setError]       = useState<string | null>(null)
  const [countdown,   setCountdown]   = useState(RESEND_SECONDS)
  const inputRef = useRef<TextInput>(null)

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  const verifyMutation = useMutation({
    mutationFn: (c: string) => authApi.verifyOtp(phone ?? '', c),
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken)
      router.replace('/(app)/')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message
      setError(msg ?? 'Неверный код. Попробуйте снова.')
      setCode('')
    },
  })

  const resendMutation = useMutation({
    mutationFn: () => authApi.sendOtp(phone ?? ''),
    onSuccess: () => {
      setCountdown(RESEND_SECONDS)
      setError(null)
      setCode('')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message
      setError(msg ?? 'Не удалось отправить код.')
    },
  })

  const handleCodeChange = useCallback((text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, CODE_LENGTH)
    setCode(clean)
    setError(null)
    if (clean.length === CODE_LENGTH) {
      verifyMutation.mutate(clean)
    }
  }, [])

  const isLoading = verifyMutation.isPending || resendMutation.isPending

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 px-6">

        {/* Back button */}
        <Pressable
          className="mt-4 mb-8 w-10 h-10 items-center justify-center rounded-full bg-slate-100"
          onPress={() => router.back()}
        >
          <Text className="text-xl text-slate-700">‹</Text>
        </Pressable>

        {/* Header */}
        <Text className="text-2xl font-bold text-slate-900 mb-2">
          Код подтверждения
        </Text>
        <Text className="text-sm text-slate-500 mb-8">
          Мы отправили SMS на номер{'\n'}
          <Text className="font-semibold text-slate-700">{maskPhone(phone ?? '')}</Text>
        </Text>

        {/* Hidden real input — keyboard input goes here */}
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

        {/* Visual 4-box code display */}
        <Pressable
          className="flex-row gap-3 mb-6"
          onPress={() => inputRef.current?.focus()}
        >
          {Array.from({ length: CODE_LENGTH }).map((_, i) => {
            const isActive  = code.length === i && !verifyMutation.isPending
            const isFilled  = i < code.length
            const hasError  = !!error

            return (
              <View
                key={i}
                className={`
                  flex-1 h-16 rounded-xl items-center justify-center border-2
                  ${hasError ? 'border-red-400 bg-red-50' :
                    isActive ? 'border-primary-600 bg-primary-50' :
                    isFilled ? 'border-primary-300 bg-white'  :
                               'border-slate-200  bg-white'}
                `}
              >
                {isLoading && i === code.length - 1 ? (
                  <ActivityIndicator color="#2563EB" size="small" />
                ) : (
                  <Text className={`text-2xl font-bold ${isFilled ? 'text-slate-900' : 'text-slate-300'}`}>
                    {isFilled ? '•' : '—'}
                  </Text>
                )}
              </View>
            )
          })}
        </Pressable>

        {/* Error message */}
        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <Text className="text-sm text-red-600">{error}</Text>
          </View>
        )}

        {/* Resend */}
        <View className="items-center mt-2">
          {countdown > 0 ? (
            <Text className="text-sm text-slate-400">
              Отправить повторно через{' '}
              <Text className="font-semibold text-slate-600">{countdown}с</Text>
            </Text>
          ) : (
            <TouchableOpacity
              onPress={() => resendMutation.mutate()}
              disabled={resendMutation.isPending}
            >
              {resendMutation.isPending ? (
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
