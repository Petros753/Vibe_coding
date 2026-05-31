import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  SafeAreaView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../src/api/auth'

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3)  return `(${digits}`
  if (digits.length <= 6)  return `(${digits.slice(0,3)}) ${digits.slice(3)}`
  if (digits.length <= 8)  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,8)}-${digits.slice(8)}`
}

export default function PhoneScreen() {
  const router  = useRouter()
  const [digits, setDigits] = useState('')
  const [error,  setError]  = useState<string | null>(null)

  const phone = `+7${digits}`

  const mutation = useMutation({
    mutationFn: () => authApi.sendOtp(phone),
    onSuccess: () => {
      router.push({ pathname: '/(auth)/otp', params: { phone } })
    },
    onError: () => {
      setError('Не удалось отправить код. Попробуйте снова.')
    },
  })

  function handleChangeText(text: string) {
    setError(null)
    const clean = text.replace(/\D/g, '').slice(0, 10)
    setDigits(clean)
  }

  function handleSubmit() {
    if (digits.length < 10) {
      setError('Введите полный номер телефона')
      return
    }
    mutation.mutate()
  }

  const isReady = digits.length === 10

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 px-6 justify-center">

          {/* Logo */}
          <View className="items-center mb-12">
            <View className="w-20 h-20 rounded-3xl bg-primary-600 items-center justify-center mb-4">
              <Text className="text-4xl text-white font-bold">М</Text>
            </View>
            <Text className="text-3xl font-bold text-slate-900">МойДом</Text>
            <Text className="text-base text-slate-500 mt-1">Управляющая компания</Text>
          </View>

          {/* Card */}
          <View className="bg-white rounded-2xl p-6 shadow-sm">
            <Text className="text-xl font-semibold text-slate-900 mb-1">
              Войти в личный кабинет
            </Text>
            <Text className="text-sm text-slate-500 mb-6">
              Введите номер телефона — мы отправим SMS с кодом
            </Text>

            {/* Phone input */}
            <View className={`
              flex-row items-center border rounded-xl px-4 h-14
              ${error ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50'}
            `}>
              <Text className="text-base text-slate-700 mr-1">+7</Text>
              <TextInput
                className="flex-1 text-base text-slate-900"
                placeholder="(900) 000-00-00"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={formatPhone(digits)}
                onChangeText={handleChangeText}
                maxLength={16}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>

            {error && (
              <Text className="text-xs text-red-500 mt-2">
                {error}
              </Text>
            )}

            {/* Submit button */}
            <TouchableOpacity
              className={`
                mt-4 h-14 rounded-xl items-center justify-center
                ${isReady && !mutation.isPending ? 'bg-primary-600' : 'bg-slate-200'}
              `}
              onPress={handleSubmit}
              disabled={!isReady || mutation.isPending}
              activeOpacity={0.8}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className={`text-base font-semibold ${isReady ? 'text-white' : 'text-slate-400'}`}>
                  Продолжить
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <Text className="text-xs text-slate-400 text-center mt-6 px-4">
            Нажимая «Продолжить», вы соглашаетесь с условиями использования сервиса
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
