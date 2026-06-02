import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  SafeAreaView, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import auth from '@react-native-firebase/auth'

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3)  return `(${digits}`
  if (digits.length <= 6)  return `(${digits.slice(0,3)}) ${digits.slice(3)}`
  if (digits.length <= 8)  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,8)}-${digits.slice(8)}`
}

export default function PhoneScreen() {
  const router = useRouter()
  const [digits,  setDigits]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)

  const phone = `+7${digits}`

  async function handleSubmit() {
    if (digits.length < 10) {
      setError('Введите полный номер телефона')
      return
    }
    setLoading(true)
    setError(null)
    setDebugInfo(null)

    try {
      setDebugInfo(`Попытка отправить на ${phone}...`)
      const confirmation = await auth().signInWithPhoneNumber(phone)
      setDebugInfo(`Успешно! Переходим к OTP...`)
      router.push({
        pathname: '/(auth)/otp',
        params: {
          phone,
          confirmationId: JSON.stringify(confirmation),
        },
      })
    } catch (err: any) {
      console.error('[Firebase Phone]', err)
      // Показываем ПОЛНУЮ информацию об ошибке
      const errorDetails = {
        code:    err?.code        || 'no code',
        message: err?.message     || 'no message',
        name:    err?.name        || 'no name',
        native:  err?.nativeErrorMessage || 'no native message',
        stack:   err?.stack?.slice(0, 300) || 'no stack',
      }
      setDebugInfo(JSON.stringify(errorDetails, null, 2))
      setError('Не удалось отправить код')
    } finally {
      setLoading(false)
    }
  }

  function handleChangeText(text: string) {
    setError(null)
    const clean = text.replace(/\D/g, '').slice(0, 10)
    setDigits(clean)
  }

  const isReady = digits.length === 10

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View className="flex-1 px-6 justify-center py-8">

            <View className="items-center mb-12">
              <View className="w-20 h-20 rounded-3xl bg-primary-600 items-center justify-center mb-4">
                <Text className="text-4xl text-white font-bold">М</Text>
              </View>
              <Text className="text-3xl font-bold text-slate-900">МойДом</Text>
              <Text className="text-base text-slate-500 mt-1">Управляющая компания</Text>
            </View>

            <View className="bg-white rounded-2xl p-6 shadow-sm">
              <Text className="text-xl font-semibold text-slate-900 mb-1">
                Войти в личный кабинет
              </Text>
              <Text className="text-sm text-slate-500 mb-6">
                Введите номер телефона — мы отправим SMS с кодом
              </Text>

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
                <Text className="text-xs text-red-500 mt-2">{error}</Text>
              )}

              <TouchableOpacity
                className={`
                  mt-4 h-14 rounded-xl items-center justify-center
                  ${isReady && !loading ? 'bg-primary-600' : 'bg-slate-200'}
                `}
                onPress={handleSubmit}
                disabled={!isReady || loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className={`text-base font-semibold ${isReady ? 'text-white' : 'text-slate-400'}`}>
                    Продолжить
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* DEBUG OUTPUT */}
            {debugInfo && (
              <View className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 mt-4">
                <Text className="text-xs font-bold text-yellow-900 mb-2">DEBUG INFO:</Text>
                <Text className="text-xs text-yellow-900" style={{ fontFamily: 'monospace' }}>
                  {debugInfo}
                </Text>
              </View>
            )}

            <Text className="text-xs text-slate-400 text-center mt-6 px-4">
              Нажимая «Продолжить», вы соглашаетесь с условиями использования сервиса
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
